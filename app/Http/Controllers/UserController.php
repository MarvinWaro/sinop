<?php

namespace App\Http\Controllers;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class UserController extends Controller
{
    public function __construct(private readonly ActivityRecorder $recorder) {}

    /**
     * Settings > Users (moved here from the admin dashboard).
     */
    public function index(Request $request)
    {
        $search = $request->get('search');

        $users = User::with('department', 'designation', 'roles:id,name,slug')
            ->when($search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('role', 'like', "%{$search}%")
                        ->orWhereHas('roles', fn ($sub) => $sub->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('department', fn ($sub) => $sub->where('name', 'like', "%{$search}%"))
                        ->orWhereHas('designation', fn ($sub) => $sub->where('name', 'like', "%{$search}%"));
                });
            })
            ->orderByRaw("CASE WHEN role = 'admin' THEN 1 WHEN role = 'cao' THEN 2 ELSE 3 END")
            ->orderBy('id')
            ->paginate(80)
            ->withQueryString();

        return Inertia::render('settings/users', [
            'users' => $users,
            'departments' => Department::all(),
            'designations' => Designation::all(),
            'roles' => Role::query()
                ->orderByRaw("CASE slug WHEN 'admin' THEN 0 WHEN 'supply-officer' THEN 1 WHEN 'cao' THEN 2 WHEN 'staff' THEN 3 ELSE 4 END")
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'description']),
            'search' => $search,
        ]);
    }

    public function storeUser(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'roles' => 'required|array|min:1',
            'roles.*' => 'integer|exists:roles,id',
            'department_id' => 'required|exists:departments,id',
            'designation_id' => 'required|exists:designations,id',
        ]);

        $this->guardSuperAdminRole($request, [], $validated['roles']);

        $defaultPassword = '12345678';

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($defaultPassword),
            'role' => 'staff', // set from the roles just below
            'department_id' => $validated['department_id'],
            'designation_id' => $validated['designation_id'],
            'status' => true,
            'needs_password_change' => true, // <— Force them to change at next login
        ]);

        $user->roles()->sync($validated['roles']);
        $user->syncLegacyRole();

        return redirect()->back()->with('success', 'User created successfully!');
    }

    public function updateUser(Request $request, $id)
    {
        $validated = $request->validate([
            'roles' => 'required|array|min:1',
            'roles.*' => 'integer|exists:roles,id',
            'department_id' => 'required|exists:departments,id',
            'designation_id' => 'required|exists:designations,id',
            'status' => 'required|boolean',
        ]);

        $user = User::findOrFail($id);
        $beforeIds = $user->roles()->pluck('roles.id')->all();
        $this->guardSuperAdminRole($request, $beforeIds, $validated['roles'], $user);

        $user->department_id = $validated['department_id'];
        $user->designation_id = $validated['designation_id'];
        $user->status = $validated['status'];
        $user->save();

        $before = $user->roles()->orderBy('name')->pluck('name')->all();
        $user->roles()->sync($validated['roles']);
        $user->syncLegacyRole();
        $after = $user->roles()->orderBy('name')->pluck('name')->all();

        if ($before !== $after) {
            $this->recorder->record(
                ActivityAction::Updated,
                ActivityModule::Users,
                $user,
                changes: ['roles' => [implode(', ', $before) ?: null, implode(', ', $after) ?: null]],
            );
        }

        // Redirect back with a success message
        return redirect()->back()->with('success', 'User updated successfully!');
    }

    public function resetPassword($id)
    {
        try {
            $user = User::findOrFail($id);

            // Set the default password
            $defaultPassword = '12345678';
            $user->password = Hash::make($defaultPassword);
            $user->needs_password_change = true; // Force password change on next login
            $user->save();

            return redirect()->back()->with('success', "Password reset successfully for {$user->name}! New password: 12345678");
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to reset password. Please try again.');
        }
    }

    /**
     * Only a super admin may give or take away the Administrator role, and the
     * last active super admin can't lose it (nobody could manage SINOP then).
     *
     * @param  list<int|string>  $before
     * @param  list<int|string>  $after
     */
    private function guardSuperAdminRole(Request $request, array $before, array $after, ?User $user = null): void
    {
        $superAdmin = Role::query()->where('slug', Role::SUPER_ADMIN)->value('id');

        if ($superAdmin === null) {
            return;
        }

        $had = in_array($superAdmin, array_map('intval', $before), true);
        $has = in_array($superAdmin, array_map('intval', $after), true);

        if ($had === $has) {
            return;
        }

        if (! $request->user()->isSuperAdmin()) {
            throw ValidationException::withMessages([
                'roles' => 'Only an Administrator can give or remove the Administrator role.',
            ]);
        }

        if ($had && ! $has && $user !== null) {
            $others = User::query()
                ->whereKeyNot($user->id)
                ->where('status', true)
                ->whereHas('roles', fn ($roles) => $roles->whereKey($superAdmin))
                ->exists();

            if (! $others) {
                throw ValidationException::withMessages([
                    'roles' => 'This is the last active Administrator. Give another account the Administrator role first.',
                ]);
            }
        }
    }
}
