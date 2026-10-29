<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\RisItem;
use App\Models\RisSlip;
use App\Models\SupplyStock;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class StaffDashboardController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();

        // Force-change-password prompt (user still has the default password)
        $forceChangePassword = Hash::check('12345678', $user->password);

        return $this->renderDashboard($request, $user, $forceChangePassword, false);
    }

    public function showChangePasswordForm()
    {
        return Inertia::render('account/change-password');
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = Auth::user();
        $user->password = Hash::make($request->password);
        $user->needs_password_change = false;
        $user->save();

        return redirect()
            ->route('staff.dashboard')
            ->with('success', 'Password changed successfully!');
    }

    /**
     * Dashboard for admin/cao when they switch to user mode
     */
    public function adminAsUser(Request $request)
    {
        if (! session('admin_user_mode')) {
            return redirect()->route('dashboard')->with('error', 'Access denied. Please switch to user mode first.');
        }

        // No force password change for admin users
        return $this->renderDashboard($request, Auth::user(), false, true);
    }

    /**
     * Shared by the staff dashboard and the admin "user mode" dashboard
     * (both rendered the same Blade view in the Jetstream version).
     */
    private function renderDashboard(Request $request, User $user, bool $forceChangePassword, bool $isAdminUserMode)
    {
        $userId = $user->id;

        // Dropdown data for the request modal
        $departments = Department::orderBy('name')->get(['id', 'name']);

        // All stocks (available and depleted) for better UX
        $stocks = SupplyStock::with('supply')
            ->whereIn('status', ['available', 'depleted'])
            ->get()
            ->map(function ($stock) {
                $pendingRequested = RisItem::where('supply_id', $stock->supply_id)
                    ->whereHas('risSlip', function ($q) {
                        $q->whereIn('status', ['draft', 'approved']);
                    })
                    ->sum('quantity_requested');

                if ($stock->status === 'depleted' || $stock->quantity_on_hand <= 0) {
                    $available = 0;
                } else {
                    $available = max(0, $stock->quantity_on_hand - $pendingRequested);
                }

                $stock->available_for_request = $available;
                $stock->is_requestable = $available > 0;

                return $stock;
            })
            ->sortBy(fn ($stock) => $stock->is_requestable ? 0 : 1)
            ->values();

        // Stats for the status filters (calculated BEFORE applying filters)
        $counts = [
            'total' => RisSlip::where('requested_by', $userId)->count(),
            'draft' => RisSlip::where('requested_by', $userId)->where('status', 'draft')->count(),
            'approved' => RisSlip::where('requested_by', $userId)->where('status', 'approved')->count(),
            'pendingReceipt' => RisSlip::where('requested_by', $userId)
                ->where('status', 'posted')
                ->whereNull('received_at')
                ->count(),
            'completed' => RisSlip::where('requested_by', $userId)
                ->where('status', 'posted')
                ->whereNotNull('received_at')
                ->count(),
            'declined' => RisSlip::where('requested_by', $userId)->where('status', 'declined')->count(),
        ];

        // "My Requests" with filters and search
        $query = RisSlip::where('requested_by', $userId)
            ->with(['department', 'items.supply'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            match ($request->status) {
                'draft' => $query->where('status', 'draft'),
                'approved' => $query->where('status', 'approved'),
                'pending-receipt' => $query->where('status', 'posted')->whereNull('received_at'),
                'completed' => $query->where('status', 'posted')->whereNotNull('received_at'),
                'declined' => $query->where('status', 'declined'),
                default => null,
            };
        }

        if ($request->filled('search')) {
            $query->where('ris_no', 'like', "%{$request->search}%");
        }

        $myRequests = $query
            ->paginate(5, ['*'], 'requests')
            ->withQueryString();

        // Received requisitions
        $risNumbers = DB::table('supply_transactions')
            ->join('user_transactions', 'supply_transactions.transaction_id', '=', 'user_transactions.transaction_id')
            ->where('user_transactions.user_id', $userId)
            ->where('user_transactions.role', 'receiver')
            ->select('reference_no')
            ->distinct()
            ->pluck('reference_no')
            ->toArray();

        $receivedRequisitions = RisSlip::whereIn('ris_no', $risNumbers)
            ->with('requester')
            ->orderBy('created_at', 'desc')
            ->paginate(5, ['*'], 'received')
            ->withQueryString();

        // Properties assigned to the user
        // Removed properties are only flagged `excluded` (and later recycled),
        // so leave them out of the holder's list.
        $properties = $user->properties()
            ->where('excluded', 0)
            ->with(['images', 'location'])
            ->orderBy('created_at', 'desc')
            ->paginate(6, ['*'], 'properties')
            ->withQueryString();

        // Notification badge counts
        $pendingReceiptCount = RisSlip::where('received_by', $userId)
            ->where('status', 'posted')
            ->whereNull('received_at')
            ->count();

        return Inertia::render('staff/dashboard', [
            'forceChangePassword' => $forceChangePassword,
            'isAdminUserMode' => $isAdminUserMode,
            'departments' => $departments,
            'stocks' => $stocks,
            'myRequests' => $myRequests,
            'receivedRequisitions' => $receivedRequisitions,
            'properties' => $properties,
            'counts' => $counts,
            'filters' => $request->only(['status', 'search']),
            'notificationCounts' => [
                'approvedRequests' => $counts['approved'],
                'pendingReceipt' => $pendingReceiptCount,
            ],
        ]);
    }
}
