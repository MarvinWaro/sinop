<?php

namespace App\Http\Controllers\Settings;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Http\Controllers\Controller;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityRecorder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Settings › Roles & permissions: named bundles of permissions. The
 * Administrator role (super admin) is locked; built-in roles can't be
 * deleted; a role still held by someone can't be deleted either.
 */
class RoleController extends Controller
{
    public function __construct(private readonly ActivityRecorder $recorder) {}

    public function index(Request $request): Response
    {
        $search = trim((string) $request->query('search', ''));
        $total = Permission::query()->count();

        $roles = Role::query()
            ->withCount('users')
            ->with('permissions:id')
            ->when($search !== '', fn ($query) => $query->where(fn ($query) => $query
                ->where('name', 'like', "%{$search}%")
                ->orWhere('description', 'like', "%{$search}%")))
            // Administrator, Supply and Procurement Officer, CAO, Staff, then the rest by name.
            ->orderByRaw("CASE slug WHEN 'admin' THEN 0 WHEN 'supply-officer' THEN 1 WHEN 'cao' THEN 2 WHEN 'staff' THEN 3 ELSE 4 END")
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role): array => [
                'id' => $role->id,
                'name' => $role->name,
                'slug' => $role->slug,
                'description' => $role->description,
                'users_count' => $role->users_count,
                'permission_ids' => $role->isSuperAdmin() ? [] : $role->permissions->pluck('id')->all(),
                'permissions_count' => $role->isSuperAdmin() ? $total : $role->permissions->count(),
                'is_super_admin' => $role->isSuperAdmin(),
                'is_built_in' => $role->isBuiltIn(),
            ]);

        return Inertia::render('settings/roles', [
            'roles' => $roles,
            'permissionGroups' => Permission::query()
                ->orderBy('group')
                ->orderBy('name')
                ->get(['id', 'name', 'slug', 'group'])
                ->groupBy('group')
                ->map(fn ($permissions, string $group): array => [
                    'group' => $group,
                    'permissions' => $permissions->map->only(['id', 'name', 'slug'])->values(),
                ])
                ->values(),
            'totalPermissions' => $total,
            'search' => $search,
            // Who holds a role, for the matrix's header.
            'people' => [
                'total' => User::query()->has('roles')->count(),
                'sample' => User::query()->has('roles')
                    ->orderByRaw('profile_photo_path is null')
                    ->orderBy('name')
                    ->limit(4)
                    ->get(['id', 'name', 'profile_photo_path'])
                    ->map(fn (User $user): array => ['id' => $user->id, 'name' => $user->name, 'photo' => $user->avatar]),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);

        $role = Role::query()->create([
            'name' => $data['name'],
            'slug' => $this->uniqueSlug($data['name']),
            'description' => $data['description'] ?? null,
        ]);
        $role->permissions()->sync($data['permissions'] ?? []);

        $names = $role->permissions()->orderBy('name')->pluck('name')->all();
        $this->recorder->record(
            ActivityAction::Created,
            ActivityModule::Roles,
            $role,
            properties: ['permissions' => $names],
            summary: count($names).' '.Str::plural('permission', count($names)),
        );

        return back()->with('success', "Role \"{$role->name}\" created.");
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        if ($role->isSuperAdmin()) {
            return back()->with('error', 'The Administrator role is locked: it always has every permission.');
        }

        $data = $this->validated($request, $role);

        $role->fill(['name' => $data['name'], 'description' => $data['description'] ?? null]);
        $this->savePermissions($role, $data['permissions'] ?? []);

        return back()->with('success', "Role \"{$role->name}\" saved.");
    }

    /**
     * The matrix: several roles' permissions saved at once. Each changed role
     * gets its own activity log entry; the Administrator is never changed.
     */
    public function permissions(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'roles' => ['required', 'array', 'min:1'],
            'roles.*.id' => ['required', 'integer', 'distinct', 'exists:roles,id'],
            'roles.*.permissions' => ['present', 'array'],
            'roles.*.permissions.*' => ['integer', 'exists:permissions,id'],
        ]);

        $roles = Role::query()->whereKey(array_column($data['roles'], 'id'))->get()->keyBy('id');

        if ($roles->contains(fn (Role $role) => $role->isSuperAdmin())) {
            return back()->with('error', 'The Administrator role is locked: it always has every permission.');
        }

        DB::transaction(function () use ($data, $roles) {
            foreach ($data['roles'] as $row) {
                $this->savePermissions($roles[$row['id']], $row['permissions']);
            }
        });

        $count = count($data['roles']);

        return back()->with('success', $count === 1
            ? "Permissions for \"{$roles->first()?->name}\" saved."
            : "Permissions for {$count} roles saved.");
    }

    public function destroy(Role $role): RedirectResponse
    {
        if ($role->isBuiltIn()) {
            return back()->with('error', "\"{$role->name}\" is a built-in role and can't be deleted.");
        }

        $holders = $role->users()->count();

        if ($holders > 0) {
            return back()->with('error', "\"{$role->name}\" is still given to {$holders} ".Str::plural('user', $holders).'. Remove it from them first.');
        }

        $role->delete();
        $this->recorder->record(ActivityAction::Deleted, ActivityModule::Roles, $role);

        return back()->with('success', "Role \"{$role->name}\" deleted.");
    }

    /**
     * @return array{name: string, description?: string|null, permissions?: list<int>}
     */
    private function validated(Request $request, ?Role $role = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('roles', 'name')->ignore($role?->id)],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);
    }

    /**
     * Saves the role (a changed name or description too) with these
     * permissions, and logs what was added and removed.
     *
     * @param  array<int, int|string>  $permissionIds
     */
    private function savePermissions(Role $role, array $permissionIds): void
    {
        $role->save();
        $changes = $this->recorder->changesOf($role);

        $before = $role->permissions()->orderBy('name')->pluck('name')->all();
        $role->permissions()->sync($permissionIds);
        $after = $role->permissions()->orderBy('name')->pluck('name')->all();

        $added = array_values(array_diff($after, $before));
        $removed = array_values(array_diff($before, $after));

        if ($changes !== [] || $added !== [] || $removed !== []) {
            $this->recorder->record(
                ActivityAction::Updated,
                ActivityModule::Roles,
                $role,
                changes: $changes,
                properties: array_filter(['permissions_added' => $added, 'permissions_removed' => $removed]),
                summary: $added === [] && $removed === [] ? null : '+'.count($added).' / −'.count($removed).' permissions',
            );
        }
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'role';
        $slug = $base;

        for ($i = 2; Role::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }

        return $slug;
    }
}
