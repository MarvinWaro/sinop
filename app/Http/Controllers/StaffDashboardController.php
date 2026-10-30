<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\RisItem;
use App\Models\RisSlip;
use App\Models\SupplyStock;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The requester side: a dashboard with the person's division analytics and
 * recent requests, and one page each for their requests, the supplies
 * issued to them and the property they're accountable for. Used by staff,
 * and by admin-side users in "user mode".
 */
class StaffDashboardController extends Controller
{
    /** The password new and reset accounts start with (see UserController). */
    private const DEFAULT_PASSWORD = '12345678';

    public function index(Request $request): Response|RedirectResponse
    {
        return $this->legacySection($request) ?? $this->renderDashboard($request, false);
    }

    /** Dashboard for admin/CAO when they switch to user mode. */
    public function adminAsUser(Request $request): Response|RedirectResponse
    {
        if (! session('admin_user_mode')) {
            return redirect()->route('dashboard')->with('error', 'Access denied. Please switch to user mode first.');
        }

        return $this->legacySection($request) ?? $this->renderDashboard($request, true);
    }

    /** The person's requisitions, with the Request supply dialog. */
    public function requests(Request $request): Response|RedirectResponse
    {
        // Old "Request supply" links opened a dialog here (?new).
        if ($request->has('new')) {
            return redirect()->route('staff.new-request');
        }

        $user = $request->user();

        $query = RisSlip::query()
            ->where('requested_by', $user->id)
            ->withCount('items')
            ->orderByDesc('created_at');

        match ($request->query('status')) {
            'draft' => $query->where('status', 'draft'),
            'approved' => $query->where('status', 'approved'),
            'pending-receipt' => $query->where('status', 'posted')->whereNull('received_at'),
            'completed' => $query->where('status', 'posted')->whereNotNull('received_at'),
            'declined' => $query->where('status', 'declined'),
            default => null,
        };

        if ($request->filled('search')) {
            $query->where('ris_no', 'like', '%'.$request->query('search').'%');
        }

        return Inertia::render('staff/requests', [
            'counts' => $this->requestCounts($user),
            'myRequests' => $query->paginate(10, ['*'], 'requests')->withQueryString(),
            'filters' => $request->only(['status', 'search']),
        ]);
    }

    /** New supply request: choose items, then review the form and sign. */
    public function newRequest(): Response
    {
        return Inertia::render('staff/request-create', [
            'supplies' => $this->requestableSupplies(),
            'departments' => Department::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    /** Requisitions whose supplies were issued to the person. */
    public function received(Request $request): Response
    {
        $userId = $request->user()->id;

        $risNumbers = DB::table('supply_transactions')
            ->join('user_transactions', 'supply_transactions.transaction_id', '=', 'user_transactions.transaction_id')
            ->where('user_transactions.user_id', $userId)
            ->where('user_transactions.role', 'receiver')
            ->distinct()
            ->pluck('reference_no');

        return Inertia::render('staff/received', [
            'receivedRequisitions' => RisSlip::query()
                ->whereIn('ris_no', $risNumbers)
                ->with('requester')
                ->orderByDesc('created_at')
                ->paginate(10, ['*'], 'received')
                ->withQueryString(),
        ]);
    }

    /** Property under the person's accountability (MR). */
    public function properties(Request $request): Response
    {
        return Inertia::render('staff/properties', [
            // Removed properties are only flagged `excluded` (and later
            // recycled), so they're left out of the holder's list.
            'properties' => $request->user()->properties()
                ->where('excluded', 0)
                ->with(['images', 'location'])
                ->orderByDesc('created_at')
                ->paginate(9, ['*'], 'properties')
                ->withQueryString(),
        ]);
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

    private function renderDashboard(Request $request, bool $isAdminUserMode): Response
    {
        $user = $request->user();
        $year = CarbonImmutable::now()->year;

        return Inertia::render('staff/dashboard', [
            'isAdminUserMode' => $isAdminUserMode,
            // No force password change for admin users.
            'forceChangePassword' => ! $isAdminUserMode && $this->usesDefaultPassword($request, $user),
            'year' => $year,
            'counts' => $this->requestCounts($user),
            'department' => $user->department?->only(['id', 'name']),
            'analytics' => $user->department_id ? $this->divisionAnalytics($user->department_id, $year) : null,
            'recentItems' => $this->recentItems($user),
        ]);
    }

    /**
     * Old links to the single-page dashboard (?received, ?properties,
     * ?status=…) go to the page that now holds that section.
     */
    private function legacySection(Request $request): ?RedirectResponse
    {
        return match (true) {
            $request->has('received') => redirect()->route('staff.received', $request->except('received')),
            $request->has('properties') => redirect()->route('staff.properties', $request->except('properties')),
            $request->hasAny(['status', 'search', 'requests']) => redirect()->route('staff.requests', $request->query()),
            default => null,
        };
    }

    /**
     * The person's requisitions by status (one query).
     *
     * @return array{total: int, draft: int, approved: int, pendingReceipt: int, completed: int, declined: int, toReceive: int}
     */
    private function requestCounts(User $user): array
    {
        $row = RisSlip::query()
            ->where('requested_by', $user->id)
            ->toBase()
            ->selectRaw("COUNT(*) AS total,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN status = 'posted' AND received_at IS NULL THEN 1 ELSE 0 END) AS pending_receipt,
                SUM(CASE WHEN status = 'posted' AND received_at IS NOT NULL THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) AS declined")
            ->first();

        return [
            'total' => (int) $row->total,
            'draft' => (int) $row->draft,
            'approved' => (int) $row->approved,
            'pendingReceipt' => (int) $row->pending_receipt,
            'completed' => (int) $row->completed,
            'declined' => (int) $row->declined,
            // Issued to them (as receiver) and waiting for their confirmation.
            'toReceive' => RisSlip::query()
                ->where('received_by', $user->id)
                ->where('status', 'posted')
                ->whereNull('received_at')
                ->count(),
        ];
    }

    /**
     * Supplies for the new request page, one row each: what's left to
     * request (on hand minus what's already requested in pending and
     * approved slips). A supply can have a stock row per fund cluster; the
     * request is checked against the first available row, so its largest
     * row counts. Requestable supplies first, then by name.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function requestableSupplies(): Collection
    {
        $pending = RisItem::query()
            ->whereHas('risSlip', fn ($query) => $query->whereIn('status', ['draft', 'approved']))
            ->groupBy('supply_id')
            ->selectRaw('supply_id, SUM(quantity_requested) AS total')
            ->pluck('total', 'supply_id');

        return SupplyStock::query()
            ->with('supply:supply_id,item_name,description,stock_no,unit_of_measurement,reorder_point,category_id', 'supply.category:id,name')
            ->whereIn('status', ['available', 'depleted'])
            ->get(['stock_id', 'supply_id', 'status', 'quantity_on_hand'])
            ->filter(fn (SupplyStock $stock) => $stock->supply !== null)
            ->map(fn (SupplyStock $stock) => [
                'supply' => $stock->supply,
                'available' => $stock->status === 'depleted' || $stock->quantity_on_hand <= 0
                    ? 0
                    : max(0, $stock->quantity_on_hand - (int) ($pending[$stock->supply_id] ?? 0)),
            ])
            ->groupBy(fn (array $row) => $row['supply']->supply_id)
            ->map(function (Collection $rows) {
                $best = $rows->sortByDesc('available')->first();
                $supply = $best['supply'];

                return [
                    'supply_id' => $supply->supply_id,
                    'name' => $supply->item_name,
                    'description' => $supply->description,
                    'stock_no' => $supply->stock_no,
                    'unit' => $supply->unit_of_measurement,
                    'category' => $supply->category?->name,
                    'reorder_point' => (int) $supply->reorder_point,
                    'available' => $best['available'],
                ];
            })
            ->sortBy([
                fn (array $a, array $b) => ($b['available'] > 0) <=> ($a['available'] > 0),
                fn (array $a, array $b) => strcmp($a['name'], $b['name']),
            ])
            ->values();
    }

    /**
     * The division's year: requisitions by status, supplies issued each
     * month (quantity) and its most-issued supplies.
     *
     * @return array<string, mixed>
     */
    private function divisionAnalytics(int $departmentId, int $year): array
    {
        $from = CarbonImmutable::create($year)->startOfYear();
        $to = $from->endOfYear();

        $slips = RisSlip::query()
            ->where('division', $departmentId)
            ->whereBetween('ris_date', [$from->toDateString(), $to->toDateString()]);

        $status = (clone $slips)->toBase()
            ->selectRaw("COUNT(*) AS total,
                SUM(CASE WHEN status IN ('draft', 'approved') THEN 1 ELSE 0 END) AS open,
                SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) AS issued,
                COUNT(DISTINCT requested_by) AS requesters")
            ->first();

        // Issued lines of the division's slips this year.
        $issued = RisItem::query()
            ->join('ris_slips', 'ris_slips.ris_id', '=', 'ris_items.ris_id')
            ->where('ris_slips.division', $departmentId)
            ->where('ris_slips.status', 'posted')
            ->whereBetween('ris_slips.ris_date', [$from->toDateString(), $to->toDateString()])
            ->where('ris_items.quantity_issued', '>', 0);

        $monthly = array_fill(0, 12, 0);

        (clone $issued)->toBase()
            ->groupBy('ris_slips.ris_id', 'ris_slips.ris_date')
            ->selectRaw('ris_slips.ris_date, SUM(ris_items.quantity_issued) AS quantity')
            ->get()
            ->each(function (object $row) use (&$monthly): void {
                $monthly[CarbonImmutable::parse($row->ris_date)->month - 1] += (int) $row->quantity;
            });

        $topSupplies = (clone $issued)->toBase()
            ->join('supplies', 'supplies.supply_id', '=', 'ris_items.supply_id')
            ->groupBy('supplies.supply_id', 'supplies.item_name', 'supplies.unit_of_measurement')
            ->selectRaw('supplies.item_name AS name, supplies.unit_of_measurement AS unit, SUM(ris_items.quantity_issued) AS quantity')
            ->orderByDesc('quantity')
            ->limit(5)
            ->get()
            ->map(fn (object $row) => ['name' => $row->name, 'unit' => $row->unit, 'quantity' => (int) $row->quantity]);

        return [
            'requests' => (int) $status->total,
            'open' => (int) $status->open,
            'issued' => (int) $status->issued,
            'requesters' => (int) $status->requesters,
            'itemsIssued' => array_sum($monthly),
            'monthly' => $monthly,
            'topSupplies' => $topSupplies,
        ];
    }

    /**
     * The supplies the person asked for most recently, with their slip's
     * number and status.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function recentItems(User $user): Collection
    {
        return RisItem::query()
            ->whereHas('risSlip', fn ($query) => $query->where('requested_by', $user->id))
            ->with([
                'supply:supply_id,item_name,stock_no,unit_of_measurement',
                'risSlip:ris_id,ris_no,ris_date,status,received_at,created_at',
            ])
            ->orderByDesc('item_id')
            ->limit(8)
            ->get()
            ->map(fn (RisItem $item) => [
                'id' => $item->item_id,
                'name' => $item->supply?->item_name ?? 'Supply #'.$item->supply_id,
                'stock_no' => $item->supply?->stock_no,
                'unit' => $item->supply?->unit_of_measurement,
                'requested' => (int) $item->quantity_requested,
                'issued' => $item->quantity_issued !== null ? (int) $item->quantity_issued : null,
                'ris' => [
                    'route_key' => $item->risSlip?->getRouteKey(),
                    'ris_no' => $item->risSlip?->ris_no,
                    'ris_date' => $item->risSlip?->ris_date?->toDateString(),
                    'status' => $item->risSlip?->status,
                    'received_at' => $item->risSlip?->received_at?->toIso8601ZuluString(),
                ],
            ]);
    }

    /**
     * Whether the person still has the default password. bcrypt is slow on
     * purpose (~0.4 s), so it's checked once per password per session.
     */
    private function usesDefaultPassword(Request $request, User $user): bool
    {
        $fingerprint = hash('sha256', (string) $user->password);
        $cached = $request->session()->get('default_password_check');

        if (is_array($cached) && ($cached['for'] ?? null) === $fingerprint) {
            return (bool) $cached['result'];
        }

        $result = Hash::check(self::DEFAULT_PASSWORD, $user->password);
        $request->session()->put('default_password_check', ['for' => $fingerprint, 'result' => $result]);

        return $result;
    }
}
