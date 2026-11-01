<?php

namespace App\Http\Controllers;

use App\Constants\RisStatus;
use App\Enums\ActivityAction;
use App\Models\Department;
use App\Models\RisItem;
use App\Models\RisSlip;
use App\Models\Supply;
use App\Models\SupplyStock; // <-- ADD THIS IMPORT
use App\Models\SupplyTransaction;
use App\Models\User;
use App\Services\Notifier;
use App\Services\ReferenceNumberService; // <-- ADD THIS IMPORT
use App\Support\ExcelDownload;
use App\Support\RisActivity;
use App\Support\RisDocument;
use App\Support\RisSignatory;
use App\Support\RisSignatureBox;
use App\Support\RisSignaturePlacement;
use App\Support\Uploads;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Throwable;

class RisSlipController extends Controller
{
    /**
     * Display a listing of the resource with manual entry support.
     */
    public function index(Request $request)
    {
        // Get total counts for stats using model scopes
        $totalCount = RisSlip::count();
        $pendingCount = RisSlip::draft()->count();
        $approvedCount = RisSlip::approved()->count();
        $pendingReceiptCount = RisSlip::pendingReceipt()->count();
        $completedCount = RisSlip::completed()->count();
        $declinedCount = RisSlip::declined()->count();

        // Start building the query with relationships
        $query = RisSlip::with(['department', 'requester', 'approver', 'issuer', 'receiver', 'decliner']);

        // Apply status filter using constants
        if ($request->filled('status')) {
            switch ($request->status) {
                case RisStatus::DRAFT:
                    $query->draft();
                    break;
                case RisStatus::APPROVED:
                    $query->approved();
                    break;
                case 'pending-receipt':
                    $query->pendingReceipt();
                    break;
                case 'completed':
                    $query->completed();
                    break;
                case RisStatus::DECLINED:
                    $query->declined();
                    break;
                case RisStatus::POSTED:
                    $query->posted();
                    break;
            }
        }

        // Apply search filter
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('ris_no', 'like', "%{$search}%")
                    ->orWhere('purpose', 'like', "%{$search}%")
                    ->orWhere('entity_name', 'like', "%{$search}%")
                    ->orWhere('office', 'like', "%{$search}%")
                    ->orWhereHas('requester', function ($subQuery) use ($search) {
                        $subQuery->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('department', function ($subQuery) use ($search) {
                        $subQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Apply date range filters
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Apply department filter if provided
        if ($request->filled('department')) {
            $query->where('division', $request->department);
        }

        // FIXED: Sort by ris_date (request date) - newest first, then by created_at, then by ris_id
        // This shows the most recent requests at the top based on actual request date
        $query->orderBy('ris_date', 'desc')
            ->orderBy('created_at', 'desc')
            ->orderBy('ris_id', 'desc');

        // Paginate with query string preservation
        $risSlips = $query->paginate(25)->appends($request->query());

        // Get departments for filter dropdown
        $departments = Department::orderBy('name')->get();

        // NEW: Get data for manual entry modal (only for admin/cao)
        $users = collect();
        $availableSupplies = collect();

        if (auth()->user()->can('ris.manual-entry')) {
            // FIXED: Get all active users for manual entry dropdown
            $users = User::where('status', true)  // <-- CHANGED from 'is_active' to 'status'
                ->with('department')  // <-- ADDED with('department') for proper loading
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'department_id'])
                ->map(function ($user) {
                    // Add department name for better display
                    $user->department_name = $user->department ? $user->department->name : 'No Department';

                    return $user;
                });

            // Check if we should show all supplies or only those with stock
            $showAllSupplies = $request->get('show_all_supplies', false);

            // Quantity already requested on draft/approved slips, per supply,
            // in one query instead of one query per supply.
            $pendingBySupply = RisItem::whereHas('risSlip', function ($q) {
                $q->whereIn('status', ['draft', 'approved']);
            })
                ->selectRaw('supply_id, SUM(quantity_requested) as total')
                ->groupBy('supply_id')
                ->pluck('total', 'supply_id');

            if ($showAllSupplies) {
                // Show ALL active supplies for historical entry
                // First available stock row per supply, loaded once.
                $stockBySupply = SupplyStock::where('status', 'available')
                    ->where('quantity_on_hand', '>', 0)
                    ->orderBy('stock_id')
                    ->get()
                    ->groupBy('supply_id')
                    ->map->first();

                $availableSupplies = Supply::where('is_active', true)  // <-- This is correct (supplies table has is_active)
                    ->orderBy('item_name')
                    ->get()
                    ->map(function ($supply) use ($stockBySupply, $pendingBySupply) {
                        // Get stock info if available
                        $stock = $stockBySupply->get($supply->supply_id);

                        $quantity_on_hand = $stock ? $stock->quantity_on_hand : 0;

                        // Calculate pending requests
                        $pendingRequested = (int) $pendingBySupply->get($supply->supply_id, 0);

                        $actualAvailable = max(0, $quantity_on_hand - $pendingRequested);

                        // Create a structured object for frontend
                        return (object) [
                            'supply_id' => $supply->supply_id,
                            'supply' => $supply,
                            'quantity_on_hand' => $quantity_on_hand,
                            'actual_available' => $actualAvailable,
                            'pending_requested' => $pendingRequested,
                            'display_name' => $supply->item_name.' ('.$supply->stock_no.')',
                            'full_description' => $supply->description,
                            'unit' => $supply->unit_of_measurement,
                            'has_stock' => $stock !== null,
                            'fund_cluster' => $stock ? $stock->fund_cluster : null,
                            'stock_no' => $supply->stock_no,
                            'item_name' => $supply->item_name,
                            'description' => $supply->description,
                            'unit_of_measurement' => $supply->unit_of_measurement,
                        ];
                    });

            } else {
                // Original logic - only supplies with available stock
                $availableSupplies = SupplyStock::with(['supply'])
                    ->where('status', 'available')
                    ->where('quantity_on_hand', '>', 0)
                    ->get()
                    ->map(function ($stock) use ($pendingBySupply) {
                        // Calculate real available quantity (minus pending requests)
                        $pendingRequested = (int) $pendingBySupply->get($stock->supply_id, 0);

                        $actualAvailable = max(0, $stock->quantity_on_hand - $pendingRequested);

                        // Only include if there's actually available quantity
                        if ($actualAvailable > 0) {
                            // Add calculated availability to the stock object
                            $stock->actual_available = $actualAvailable;
                            $stock->pending_requested = $pendingRequested;

                            // Add supply details for easier access in frontend
                            $stock->display_name = $stock->supply->item_name.' ('.$stock->supply->stock_no.')';
                            $stock->full_description = $stock->supply->description;
                            $stock->unit = $stock->supply->unit_of_measurement;
                            $stock->has_stock = true;

                            // Add these for consistency with the show all supplies structure
                            $stock->stock_no = $stock->supply->stock_no;
                            $stock->item_name = $stock->supply->item_name;
                            $stock->description = $stock->supply->description;
                            $stock->unit_of_measurement = $stock->supply->unit_of_measurement;

                            return $stock;
                        }

                        return null;
                    })
                    ->filter() // Remove null entries
                    ->sortBy('display_name') // Sort by display name for better UX
                    ->values(); // Reset array keys
            }
        }

        return Inertia::render('ris/index', [
            'risSlips' => $risSlips,
            'counts' => [
                'total' => $totalCount,
                'draft' => $pendingCount,
                'approved' => $approvedCount,
                'pendingReceipt' => $pendingReceiptCount,
                'completed' => $completedCount,
                'declined' => $declinedCount,
            ],
            'departments' => $departments,
            'users' => $users->values(),
            'availableSupplies' => $availableSupplies->values(),
            'showAllSupplies' => (bool) $request->get('show_all_supplies', false),
            'filters' => $request->only(['status', 'search', 'date_from', 'date_to', 'department']),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, ReferenceNumberService $referenceNumberService)
    {
        // Validate the form data
        $validated = $request->validate([
            'entity_name' => 'required|string',
            'division' => 'required|exists:departments,id',
            'office' => 'nullable|string',
            'fund_cluster' => 'nullable|string',
            'responsibility_center_code' => 'nullable|string',
            'purpose' => 'nullable|string',
            'supplies' => 'required|array',
            'supplies.*.supply_id' => 'required|exists:supplies,supply_id',
            'supplies.*.quantity' => 'required|integer|min:1',
            'signature_type' => 'required|in:esign,sgd',
            ...RisSignaturePlacement::rules($request->user()),
        ], RisSignaturePlacement::messages());

        $maxAttempts = 5;
        $attempt = 0;

        do {
            $attempt++;
            // Generate a new RIS number each attempt
            $newRisNumber = $referenceNumberService->generateRisNumber();

            try {
                // Begin transaction (retried up to 3 times if two requests
                // deadlock on the stock lock)
                return DB::transaction(function () use ($validated, $newRisNumber) {
                    // First come, first served: a request for the same supply
                    // waits here until the earlier one is saved, so the stock
                    // check sees what that request took.
                    $this->lockStockOf(collect($validated['supplies'])->pluck('supply_id'));
                    $this->ensureStockAvailable($validated['supplies']);

                    // Check again to avoid any duplicate number
                    if (RisSlip::where('ris_no', $newRisNumber)->exists()) {
                        throw new \Exception('RIS number already exists, retrying...');
                    }

                    // Create RIS Slip
                    $risSlip = RisSlip::create([
                        'ris_no' => $newRisNumber,
                        'ris_date' => now(),
                        'entity_name' => $validated['entity_name'],
                        'division' => $validated['division'],
                        'office' => $validated['office'],
                        'fund_cluster' => $validated['fund_cluster'],
                        'responsibility_center_code' => $validated['responsibility_center_code'],
                        'requested_by' => Auth::id(),
                        'requester_signature_type' => $validated['signature_type'],
                        'purpose' => $validated['purpose'] ?? null,
                        'status' => 'draft',
                    ]);

                    if ($validated['signature_type'] === 'esign') {
                        RisSignaturePlacement::record($risSlip, 'requested', Auth::user(), $validated['signature']);
                    }

                    // Create RIS Items
                    foreach ($validated['supplies'] as $item) {
                        $stockAvailable = SupplyStock::where('supply_id', $item['supply_id'])
                            ->where('status', 'available')
                            ->sum('quantity_on_hand') >= $item['quantity'];

                        RisItem::create([
                            'ris_id' => $risSlip->ris_id,
                            'supply_id' => $item['supply_id'],
                            'quantity_requested' => $item['quantity'],
                            'stock_available' => $stockAvailable,
                        ]);
                    }

                    $entry = RisActivity::record(ActivityAction::Requested, $risSlip);

                    // Tell whoever approves (live signal goes out after the response).
                    app(Notifier::class)->risSubmitted($entry);

                    // Back to the list (the request page is done with).
                    return redirect()->route('staff.requests')->with('success', 'Requisition created successfully with RIS# '.$newRisNumber);
                }, 3);
            } catch (\Exception $e) {
                // Retry only for RIS number conflict
                if ($attempt >= $maxAttempts || strpos($e->getMessage(), 'retrying') === false) {
                    throw $e;
                }
                usleep(150000); // 0.15s sleep before retry
            }
        } while ($attempt < $maxAttempts);

        return back()->with('error', 'Failed to generate unique RIS number after several attempts.');
    }

    /**
     * Locks the stock rows of these supplies until the surrounding
     * transaction ends, so requests for the same supply are checked and
     * saved one after another instead of at the same moment.
     *
     * Call it as the transaction's first query: MySQL reads after it then
     * see what the earlier request saved. Rows are locked in supply order,
     * so two requests can't hold each other's rows.
     *
     * @param  iterable<int|string>  $supplyIds
     */
    private function lockStockOf(iterable $supplyIds): void
    {
        SupplyStock::query()
            ->whereIn('supply_id', collect($supplyIds)->map(fn ($id) => (int) $id)->unique()->sort()->values())
            ->orderBy('supply_id')
            ->orderBy('stock_id')
            ->lockForUpdate()
            ->pluck('stock_id');
    }

    /**
     * The requester's stock check: what's on hand minus what Pending and
     * Approved requests already hold. Throws the "Stock availability has
     * changed" errors when an item asks for more.
     *
     * @param  array<int, array{supply_id: int|string, quantity: int|string}>  $supplies
     */
    private function ensureStockAvailable(array $supplies): void
    {
        $stockValidationErrors = [];

        foreach ($supplies as $index => $item) {
            $supplyId = $item['supply_id'];
            $requestedQty = $item['quantity'];

            // Calculate current real-time availability
            $stock = SupplyStock::where('supply_id', $supplyId)
                ->where('status', 'available')
                ->where('quantity_on_hand', '>', 0)
                ->first();

            if (! $stock) {
                $stockValidationErrors[] = [
                    'supply_id' => $supplyId,
                    'message' => 'Item is no longer available',
                    'available' => 0,
                ];

                continue;
            }

            $pendingRequested = RisItem::where('supply_id', $supplyId)
                ->whereHas('risSlip', function ($q) {
                    $q->whereIn('status', ['draft', 'approved']);
                })
                ->sum('quantity_requested');

            $currentAvailable = max(0, $stock->quantity_on_hand - $pendingRequested);

            if ($requestedQty > $currentAvailable) {
                $supply = Supply::find($supplyId);
                $stockValidationErrors[] = [
                    'supply_id' => $supplyId,
                    'supply_name' => $supply ? $supply->item_name : 'Unknown Item',
                    'requested' => $requestedQty,
                    'available' => $currentAvailable,
                    'message' => "Only {$currentAvailable} units available (requested: {$requestedQty})",
                ];
            }
        }

        // If there are stock validation errors, send them back as validation errors
        if (! empty($stockValidationErrors)) {
            $messages = [
                'supplies' => 'Stock availability has changed. Please review and update your request.',
            ];

            foreach ($supplies as $index => $item) {
                foreach ($stockValidationErrors as $error) {
                    if ((string) $error['supply_id'] === (string) $item['supply_id']) {
                        $messages["supplies.{$index}.quantity"] = isset($error['supply_name'])
                            ? "{$error['supply_name']}: {$error['message']}"
                            : $error['message'];
                    }
                }
            }

            throw ValidationException::withMessages($messages);
        }
    }

    public function validateStock(Request $request)
    {
        $validated = $request->validate([
            'supplies' => 'required|array',
            'supplies.*.supply_id' => 'required|exists:supplies,supply_id',
            'supplies.*.quantity' => 'required|integer|min:1',
        ]);

        $stockValidationErrors = [];
        $currentAvailability = [];

        foreach ($validated['supplies'] as $index => $item) {
            $supplyId = $item['supply_id'];
            $requestedQty = $item['quantity'];

            // Calculate current real-time availability
            $stock = SupplyStock::where('supply_id', $supplyId)
                ->where('status', 'available')
                ->where('quantity_on_hand', '>', 0)
                ->first();

            if (! $stock) {
                $stockValidationErrors[] = [
                    'supply_id' => $supplyId,
                    'message' => 'Item is no longer available',
                    'available' => 0,
                ];
                $currentAvailability[$supplyId] = 0;

                continue;
            }

            $pendingRequested = RisItem::where('supply_id', $supplyId)
                ->whereHas('risSlip', function ($q) {
                    $q->whereIn('status', ['draft', 'approved']);
                })
                ->sum('quantity_requested');

            $currentAvailable = max(0, $stock->quantity_on_hand - $pendingRequested);
            $currentAvailability[$supplyId] = $currentAvailable;

            if ($requestedQty > $currentAvailable) {
                $supply = Supply::find($supplyId);
                $stockValidationErrors[] = [
                    'supply_id' => $supplyId,
                    'supply_name' => $supply ? $supply->item_name : 'Unknown Item',
                    'requested' => $requestedQty,
                    'available' => $currentAvailable,
                    'message' => "Only {$currentAvailable} units available (requested: {$requestedQty})",
                ];
            }
        }

        return response()->json([
            'success' => empty($stockValidationErrors),
            'errors' => $stockValidationErrors,
            'current_availability' => $currentAvailability,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(RisSlip $risSlip)
    {
        $risSlip->load([
            'department',
            'requester.designation',
            'approver.designation',
            'issuer.designation',
            'receiver.designation',
            'decliner',
            'items.supply',
            'signatures',
        ]);

        // Calculate availability for each item across all fund clusters
        foreach ($risSlip->items as $item) {
            $item->total_available = SupplyStock::where('supply_id', $item->supply_id)
                ->where('status', 'available')
                ->sum('quantity_on_hand');

            // Get available in the specific fund cluster
            $item->matching_fund_available = SupplyStock::where('supply_id', $item->supply_id)
                ->where('status', 'available')
                ->where('fund_cluster', $risSlip->fund_cluster)
                ->sum('quantity_on_hand');
        }

        // Users grouped by department for the "Received By" select in the issue dialog
        $recipients = collect();

        if (auth()->user()->can('ris.issue') && $risSlip->canBeIssued()) {
            $recipients = User::with(['department', 'designation'])
                ->get()
                ->groupBy(fn ($user) => $user->department ? $user->department->name : 'No Department')
                ->sortKeys()
                ->map(fn ($users, $departmentName) => [
                    'department' => $departmentName,
                    'users' => $users->sortBy('name')->values()->map(fn ($user) => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'designation' => $user->designation?->name,
                    ]),
                ])
                ->values();
        }

        return Inertia::render('ris/show', [
            'risSlip' => $risSlip,
            'recipients' => $recipients,
            'permissions' => [
                'canApprove' => auth()->user()->can('ris.approve') && $risSlip->canBeApproved(),
                'canDecline' => auth()->user()->can('ris.approve') && $risSlip->canBeDeclined(),
                'canIssue' => auth()->user()->can('ris.issue') && $risSlip->canBeIssued(),
                'canReceive' => (int) auth()->id() === (int) $risSlip->received_by
                    && is_null($risSlip->received_at)
                    && $risSlip->status === 'posted',
            ],
        ]);
    }

    /**
     * Approve the RIS.
     */
    public function approve(Request $request, RisSlip $risSlip)
    {
        if ($risSlip->status !== 'draft') {
            return back()->with('error', 'This RIS cannot be approved.');
        }

        // Validate the fund cluster and signature type
        $validated = $request->validate([
            'fund_cluster' => 'nullable|string',
            'signature_type' => 'required|in:esign,sgd',
            ...RisSignaturePlacement::rules($request->user()),
        ], RisSignaturePlacement::messages());

        DB::transaction(function () use ($risSlip, $validated) {
            $risSlip->update([
                'status' => 'approved',
                'approved_by' => Auth::id(),
                'approved_at' => now(),
                'approver_signature_type' => $validated['signature_type'],
                'fund_cluster' => $validated['fund_cluster'] ?? $risSlip->fund_cluster,
            ]);

            if ($validated['signature_type'] === 'esign') {
                RisSignaturePlacement::record($risSlip, 'approved', Auth::user(), $validated['signature']);
            }
        });

        $entry = RisActivity::record(ActivityAction::Approved, $risSlip);

        // Tell the requester, and whoever issues supplies.
        app(Notifier::class)->risApproved($risSlip, $entry);

        return back()->with('success', 'RIS approved successfully.');
    }

    /**
     * Decline the RIS.
     */
    public function decline(Request $request, RisSlip $risSlip)
    {
        // Validate that the RIS can be declined
        if (! $risSlip->canBeDeclined()) {
            return back()->with('error', 'This RIS cannot be declined. Only draft requisitions can be declined.');
        }

        // Validate the decline reason
        $validated = $request->validate([
            'decline_reason' => 'required|string|min:10|max:500',
        ], [
            'decline_reason.required' => 'A decline reason is required.',
            'decline_reason.min' => 'The decline reason must be at least 10 characters.',
            'decline_reason.max' => 'The decline reason cannot exceed 500 characters.',
        ]);

        try {
            DB::beginTransaction();

            // Update the RIS status to declined
            $risSlip->update([
                'status' => RisStatus::DECLINED,
                'declined_by' => Auth::id(),
                'declined_at' => now(),
                'decline_reason' => trim($validated['decline_reason']),
            ]);

            DB::commit();

            $entry = RisActivity::record(ActivityAction::Declined, $risSlip, summary: 'Reason: '.trim($validated['decline_reason']), properties: ['reason' => trim($validated['decline_reason'])]);

            // Tell the requester.
            app(Notifier::class)->risDeclined($risSlip, $entry);

            \Log::info('RIS declined successfully', [
                'ris_id' => $risSlip->ris_id,
                'ris_no' => $risSlip->ris_no,
                'declined_by' => Auth::id(),
                'declined_by_name' => Auth::user()->name,
                'reason' => $validated['decline_reason'],
            ]);

            return back()->with('success', "{$risSlip->ris_no} has been declined successfully. The requester has been notified with your reason.");

        } catch (\Exception $e) {
            DB::rollBack();

            \Log::error('Error declining RIS', [
                'ris_id' => $risSlip->ris_id,
                'ris_no' => $risSlip->ris_no,
                'declined_by' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return back()->with('error', 'An error occurred while declining the RIS. Please try again or contact support.');
        }
    }

    public function issue(Request $request, RisSlip $risSlip)
    {
        if ($risSlip->status !== 'approved') {
            return back()->with('error', 'This RIS cannot be issued.');
        }

        // Enhanced validation with proper business logic
        $validated = $request->validate([
            'items' => 'required|array',
            'items.*.item_id' => 'required|exists:ris_items,item_id',
            'items.*.quantity_issued' => 'required|integer|min:0',
            'items.*.remarks' => 'nullable|string|max:500',
            'received_by' => 'required|exists:users,id',  // Made required
            'signature_type' => 'required|in:esign,sgd',
            ...RisSignaturePlacement::rules($request->user()),
        ], RisSignaturePlacement::messages());

        return DB::transaction(function () use ($validated, $risSlip, $request) {
            $hasIssuedItems = false;
            $validationErrors = [];

            // PRE-VALIDATION: Check all items before processing
            foreach ($validated['items'] as $itemData) {
                $risItem = RisItem::findOrFail($itemData['item_id']);

                // Get current stock availability
                $totalAvailable = SupplyStock::where('supply_id', $risItem->supply_id)
                    ->where('status', 'available')
                    ->sum('quantity_on_hand');

                $requestedQty = $risItem->quantity_requested;
                $issueQty = $itemData['quantity_issued'];

                // BUSINESS RULE VALIDATION:
                // 1. Maximum issue quantity is min(requested, available)
                // 2. Less than that, down to 0, is allowed (e.g. stock held in
                //    reserve), but the remarks must say why
                // 3. Nothing can be issued when no stock is available

                if ($totalAvailable > 0) {
                    $maxAllowedQty = min($totalAvailable, $requestedQty);
                    if ($issueQty > $maxAllowedQty) {
                        $validationErrors[] = "Item '{$risItem->supply->item_name}' - Maximum issue quantity is {$maxAllowedQty} (Available: {$totalAvailable}, Requested: {$requestedQty}).";

                        continue;
                    }

                    if ($issueQty < $maxAllowedQty && blank($itemData['remarks'] ?? null)) {
                        $validationErrors[] = "Item '{$risItem->supply->item_name}' - {$maxAllowedQty} can be issued but {$issueQty} is entered. Say why in its remarks.";

                        continue;
                    }
                } else {
                    // No stock available - only 0 is allowed
                    if ($issueQty > 0) {
                        $validationErrors[] = "Item '{$risItem->supply->item_name}' has no stock available. Cannot issue {$issueQty} units.";

                        continue;
                    }
                }

                if ($issueQty > 0) {
                    $hasIssuedItems = true;
                }
            }

            // Return validation errors if any
            if (! empty($validationErrors)) {
                return back()->withErrors(['issue_validation' => implode(' ', $validationErrors)])
                    ->with('error', 'Please correct the issue quantities before proceeding.')
                    ->withInput();
            }

            // Business rule: At least one item must be issued
            if (! $hasIssuedItems) {
                return back()->with('error', 'You must issue at least one item. Cannot process issuance with all quantities set to zero.');
            }

            // Process each item (existing logic but with better logging)
            foreach ($validated['items'] as $itemData) {
                $risItem = RisItem::findOrFail($itemData['item_id']);
                $issueQty = $itemData['quantity_issued'];

                // Update RIS item
                $risItem->update([
                    'quantity_issued' => $issueQty,
                    'remarks' => $itemData['remarks'] ?? null,
                ]);

                // Only process stock deduction if quantity > 0
                if ($issueQty > 0) {
                    // Get all available stocks for this supply (FIFO approach)
                    $matchingStocks = SupplyStock::where('supply_id', $risItem->supply_id)
                        ->where('status', 'available')
                        ->where('quantity_on_hand', '>', 0)
                        ->orderBy('expiry_date', 'asc') // Use FIFO approach - oldest stock first
                        ->orderBy('created_at', 'asc')   // If same expiry, use oldest entry first
                        ->get();

                    // Calculate current balance before issuance
                    $currentBalance = SupplyStock::where('supply_id', $risItem->supply_id)
                        ->where('status', 'available')
                        ->sum('quantity_on_hand');

                    // Process the issuance from stocks
                    $remainingQuantity = $issueQty;
                    $totalCost = 0;

                    foreach ($matchingStocks as $stock) {
                        if ($remainingQuantity <= 0) {
                            break;
                        }

                        $qtyToDeduct = min($remainingQuantity, $stock->quantity_on_hand);

                        // Update stock quantity
                        $stock->quantity_on_hand -= $qtyToDeduct;
                        $stockItemCost = $qtyToDeduct * $stock->unit_cost;
                        $totalCost += $stockItemCost;

                        // Update or mark as depleted if zero
                        if ($stock->quantity_on_hand <= 0) {
                            $stock->status = 'depleted';
                        }
                        $stock->save();

                        // Calculate the new balance after this deduction
                        $newBalance = $currentBalance - $qtyToDeduct;

                        // Create the transaction using direct DB query
                        $transaction = DB::table('supply_transactions')->insertGetId([
                            'supply_id' => $risItem->supply_id,
                            'transaction_type' => 'issue',
                            'transaction_date' => now()->toDateString(),
                            'reference_no' => $risSlip->ris_no,
                            'quantity' => $qtyToDeduct,
                            'unit_cost' => $stock->unit_cost,
                            'total_cost' => $stockItemCost,
                            'department_id' => $risSlip->division,
                            'remarks' => "Issued via RIS #{$risSlip->ris_no}".($itemData['remarks'] ? " - {$itemData['remarks']}" : ''),
                            'balance_quantity' => $newBalance,
                            'user_id' => Auth::id(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);

                        // Set up the many-to-many relationships
                        if ($risSlip->requested_by) {
                            DB::table('user_transactions')->insert([
                                'transaction_id' => $transaction,
                                'user_id' => $risSlip->requested_by,
                                'role' => 'requester',
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }

                        if ($request->received_by) {
                            DB::table('user_transactions')->insert([
                                'transaction_id' => $transaction,
                                'user_id' => $request->received_by,
                                'role' => 'receiver',
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }

                        $remainingQuantity -= $qtyToDeduct;
                        $currentBalance = $newBalance;
                    }

                    // Log if there was insufficient stock to fulfill the complete request
                    if ($remainingQuantity > 0) {
                        \Log::warning('Insufficient stock for complete fulfillment', [
                            'ris_no' => $risSlip->ris_no,
                            'supply_id' => $risItem->supply_id,
                            'item_name' => $risItem->supply->item_name,
                            'requested' => $issueQty,
                            'fulfilled' => $issueQty - $remainingQuantity,
                            'shortfall' => $remainingQuantity,
                        ]);
                    }
                } else {
                    // Log items that couldn't be issued (for audit trail)
                    \Log::info('Item not issued due to insufficient stock', [
                        'ris_no' => $risSlip->ris_no,
                        'supply_id' => $risItem->supply_id,
                        'item_name' => $risItem->supply->item_name,
                        'reason' => 'No stock available',
                    ]);
                }
            }

            // Update the RIS status
            $risSlip->update([
                'status' => 'posted',
                'issued_by' => Auth::id(),
                'issued_at' => now(),
                'issuer_signature_type' => $validated['signature_type'],
                'received_by' => $request->received_by,
            ]);

            if ($validated['signature_type'] === 'esign') {
                RisSignaturePlacement::record($risSlip, 'issued', Auth::user(), $validated['signature']);
            }

            $entry = RisActivity::record(ActivityAction::Issued, $risSlip, properties: ['received_by' => User::find($request->received_by)?->name], withStock: true);

            // Tell the receiver and the requester, and warn supply staff
            // about anything this issue left low or out of stock.
            $notifier = app(Notifier::class);
            $notifier->risIssued($risSlip, $entry);
            $notifier->stockLevels(
                RisItem::where('ris_id', $risSlip->ris_id)->where('quantity_issued', '>', 0)->pluck('supply_id'),
                $entry,
            );

            // Enhanced success logging
            $issuedItemsCount = collect($validated['items'])->where('quantity_issued', '>', 0)->count();
            $totalItemsCount = count($validated['items']);

            \Log::info('RIS issued successfully', [
                'ris_id' => $risSlip->ris_id,
                'ris_no' => $risSlip->ris_no,
                'issued_by' => Auth::id(),
                'issued_by_name' => Auth::user()->name,
                'received_by' => $request->received_by,
                'total_items' => $totalItemsCount,
                'issued_items' => $issuedItemsCount,
                'signature_type' => $validated['signature_type'],
            ]);

            return redirect()->route('ris.show', $risSlip)
                ->with('success', "Supplies issued successfully! {$issuedItemsCount} out of {$totalItemsCount} items processed.");
        });
    }

    public function receive(Request $request, RisSlip $risSlip)
    {
        // Validate the signature type
        $validated = $request->validate([
            'signature_type' => 'required|in:esign,sgd',
            ...RisSignaturePlacement::rules($request->user()),
        ], RisSignaturePlacement::messages());

        // Normalize types (some hosts return IDs as strings)
        $currentUserId = (int) auth()->id();
        $receiverId = (int) $risSlip->received_by;

        // Check if the current user is the one assigned to receive
        if ($receiverId !== $currentUserId) {
            return back()->with('error', 'You are not authorized to receive this RIS.');
        }

        // Check if already received
        if (! is_null($risSlip->received_at)) {
            return back()->with('error', 'This RIS has already been received.');
        }

        // Check if the RIS has been issued
        if ($risSlip->status !== 'posted' || is_null($risSlip->issued_at)) {
            return back()->with('error', 'This RIS has not been issued yet.');
        }

        // Update the received timestamp with signature type
        DB::transaction(function () use ($risSlip, $validated) {
            $risSlip->update([
                'received_at' => now(),
                'receiver_signature_type' => $validated['signature_type'],
            ]);

            if ($validated['signature_type'] === 'esign') {
                RisSignaturePlacement::record($risSlip, 'received', Auth::user(), $validated['signature']);
            }
        });

        $entry = RisActivity::record(ActivityAction::Received, $risSlip);

        // Tell whoever issues and approves requisitions.
        app(Notifier::class)->risReceived($entry);

        return back()->with('success', 'Supplies received successfully.');
    }

    /**
     * The form as it prints, for the signing preview.
     */
    public function document(RisSlip $risSlip): JsonResponse
    {
        return response()->json(RisDocument::of($risSlip));
    }

    /**
     * Export RIS to Excel with E-Signature Images
     */
    public function exportExcel(RisSlip $risSlip)
    {
        // Create Excel file
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();

        // Set page setup
        $sheet->getPageSetup()->setOrientation(PageSetup::ORIENTATION_PORTRAIT);
        $sheet->getPageSetup()->setPaperSize(PageSetup::PAPERSIZE_LETTER);
        $sheet->getPageMargins()->setTop(0.5)->setRight(0.5)->setLeft(0.5)->setBottom(0.5);

        // Appendix 63 (top right)
        $sheet->setCellValue('H1', 'Appendix 63');
        $sheet->getStyle('H1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle('H1')->getFont()->setItalic(true)->setSize(15);

        // Title
        $sheet->mergeCells('A3:H3');
        $sheet->setCellValue('A3', 'REQUISITION AND ISSUE SLIP');
        $sheet->getStyle('A3')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $currentRow = 5;

        // Entity Information Section (NO BORDERS - just underlines like the template)
        // First row - Entity Name and Fund Cluster
        $sheet->setCellValue("A{$currentRow}", 'Entity Name:');
        $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
        $sheet->mergeCells("B{$currentRow}:F{$currentRow}");
        $sheet->setCellValue("B{$currentRow}", $risSlip->entity_name);
        // Add underline only (no full borders)
        $sheet->getStyle("B{$currentRow}:F{$currentRow}")->getBorders()->getBottom()->setBorderStyle(Border::BORDER_THIN);

        $sheet->setCellValue("G{$currentRow}", 'Fund Cluster:');
        $sheet->getStyle("G{$currentRow}")->getFont()->setBold(true);
        $sheet->setCellValue("H{$currentRow}", $risSlip->fund_cluster);
        // Add underline only (no full borders)
        $sheet->getStyle("H{$currentRow}")->getBorders()->getBottom()->setBorderStyle(Border::BORDER_THIN);

        $currentRow++;

        // Second row - Division and Responsibility Center Code (with borders)
        $sheet->setCellValue("A{$currentRow}", 'Division:');
        $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
        $sheet->mergeCells("B{$currentRow}:D{$currentRow}");
        $sheet->setCellValue("B{$currentRow}", $risSlip->department->name ?? 'N/A');
        $sheet->getStyle("A{$currentRow}:D{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $sheet->setCellValue("E{$currentRow}", 'Responsibility Center Code:');
        $sheet->getStyle("E{$currentRow}")->getFont()->setBold(true);
        $sheet->mergeCells("F{$currentRow}:H{$currentRow}");
        $sheet->setCellValue("F{$currentRow}", $risSlip->responsibility_center_code ?? '');
        $sheet->getStyle("E{$currentRow}:H{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $currentRow++;

        // Third row - Office and RIS No. (with borders)
        $sheet->setCellValue("A{$currentRow}", 'Office:');
        $sheet->getStyle("A{$currentRow}")->getFont()->setBold(true);
        $sheet->mergeCells("B{$currentRow}:D{$currentRow}");
        $sheet->setCellValue("B{$currentRow}", $risSlip->office ?? '');
        $sheet->getStyle("A{$currentRow}:D{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $sheet->setCellValue("E{$currentRow}", 'RIS No.:');
        $sheet->getStyle("E{$currentRow}")->getFont()->setBold(true);
        $sheet->mergeCells("F{$currentRow}:H{$currentRow}");
        $sheet->setCellValue("F{$currentRow}", $risSlip->ris_no);
        $sheet->getStyle("E{$currentRow}:H{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $currentRow++; // Add space

        // Main items table headers
        // First header row with merged sections
        $sheet->mergeCells("A{$currentRow}:D{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", 'Requisition');
        $sheet->mergeCells("E{$currentRow}:F{$currentRow}");
        $sheet->setCellValue("E{$currentRow}", 'Stock Available?');
        $sheet->mergeCells("G{$currentRow}:H{$currentRow}");
        $sheet->setCellValue("G{$currentRow}", 'Issue');

        // Style first header row
        $headerRange = "A{$currentRow}:H{$currentRow}";
        $sheet->getStyle($headerRange)->applyFromArray([
            'font' => ['bold' => true, 'size' => 12],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => 'F2F2F2'],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        $currentRow++;

        // Second header row with detailed columns
        $subHeaders = [
            'A' => 'Stock No.',
            'B' => 'Unit',
            'C' => 'Description',
            'D' => 'Quantity',
            'E' => 'Yes',
            'F' => 'No',
            'G' => 'Quantity',
            'H' => 'Remarks',
        ];

        foreach ($subHeaders as $col => $header) {
            $sheet->setCellValue("{$col}{$currentRow}", $header);
        }

        // Style second header row
        $subHeaderRange = "A{$currentRow}:H{$currentRow}";
        $sheet->getStyle($subHeaderRange)->applyFromArray([
            'font' => ['bold' => true, 'size' => 10],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => 'F2F2F2'],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        $sheet->getRowDimension($currentRow - 1)->setRowHeight(25);
        $sheet->getRowDimension($currentRow)->setRowHeight(25);

        // Data rows
        $currentRow++;

        foreach ($risSlip->items as $item) {
            $sheet->setCellValue("A{$currentRow}", $item->supply->stock_no ?? 'N/A');
            $sheet->setCellValue("B{$currentRow}", $item->supply->unit_of_measurement ?? 'N/A');

            // Description (combine item name and description)
            $parts = [
                $item->supply->item_name,
                $item->supply->description,
            ];
            $display = collect($parts)->filter()->join(', ');
            $sheet->setCellValue("C{$currentRow}", $display ?: 'N/A');

            $sheet->setCellValue("D{$currentRow}", $item->quantity_requested);

            // Stock Available columns (Yes/No)
            $sheet->setCellValue("E{$currentRow}", $item->stock_available ? '✓' : '');
            $sheet->setCellValue("F{$currentRow}", ! $item->stock_available ? '✓' : '');

            // Issue quantity and remarks
            $sheet->setCellValue("G{$currentRow}", $item->quantity_issued ?? '');
            $sheet->setCellValue("H{$currentRow}", $item->remarks ?? '');

            // Format numbers
            $sheet->getStyle("D{$currentRow}")->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyle("G{$currentRow}")->getNumberFormat()->setFormatCode('#,##0');

            // Apply borders
            $sheet->getStyle("A{$currentRow}:H{$currentRow}")->getBorders()
                ->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

            // Alignment
            $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("B{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
            $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("E{$currentRow}:F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("G{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            $sheet->getStyle("H{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

            $currentRow++;
        }

        // // Add empty rows to match template format (minimum 10 rows total)
        // $emptyRowsToAdd = max(10 - count($risSlip->items), 0);
        // for ($i = 0; $i < $emptyRowsToAdd; $i++) {
        //     $sheet->getStyle("A{$currentRow}:H{$currentRow}")->getBorders()
        //         ->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        //     $currentRow++;
        // }

        // $currentRow += 1; // Add small space before purpose

        // Purpose section
        $sheet->setCellValue("A{$currentRow}", 'Purpose:');
        $sheet->getStyle("A{$currentRow}")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => 'F2F2F2'],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        $sheet->mergeCells("B{$currentRow}:H{$currentRow}");
        $sheet->getStyle("B{$currentRow}:H{$currentRow}")->applyFromArray([
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['rgb' => 'F2F2F2'],
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN],
            ],
        ]);

        $currentRow++;

        // Purpose content (smaller - only 2 rows)
        $sheet->mergeCells("A{$currentRow}:H".($currentRow + 1));
        $sheet->setCellValue("A{$currentRow}", $risSlip->purpose);
        $sheet->getStyle("A{$currentRow}:H".($currentRow + 1))->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setVertical(Alignment::VERTICAL_TOP)->setWrapText(true);
        $sheet->getRowDimension($currentRow)->setRowHeight(30);

        $currentRow += 2; // Move past purpose content

        // Signature section (NO gap - directly connected)
        $signatureHeaders = ['Requested by:', 'Approved by:', 'Issued by:', 'Received by:'];

        // Header row with labels
        $sheet->mergeCells("A{$currentRow}:B{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", '');
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        $sheet->setCellValue("C{$currentRow}", 'Requested by:');
        $sheet->getStyle("C{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("C{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells("D{$currentRow}:E{$currentRow}");
        $sheet->setCellValue("D{$currentRow}", 'Approved by:');
        $sheet->getStyle("D{$currentRow}:E{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("D{$currentRow}:E{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells("F{$currentRow}:G{$currentRow}");
        $sheet->setCellValue("F{$currentRow}", 'Issued by:');
        $sheet->getStyle("F{$currentRow}:G{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("F{$currentRow}:G{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->setCellValue("H{$currentRow}", 'Received by:');
        $sheet->getStyle("H{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("H{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("H{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $currentRow++;

        // Signature row with label in columns A-B
        $sheet->mergeCells("A{$currentRow}:B{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", 'Signature :');
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        // Set higher row height for signature images
        $sheet->getRowDimension($currentRow)->setRowHeight(50);

        // Apply borders to all signature cells first
        $sheet->getStyle("C{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("D{$currentRow}:E{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("F{$currentRow}:G{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("H{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);

        // The signatures: the copy frozen at signing, where the signer placed
        // it; slips signed before that use the person's current signature.
        // SGD, or an e-signature with no image, prints "SGD".
        $sheet->mergeCells("D{$currentRow}:E{$currentRow}");
        $sheet->mergeCells("F{$currentRow}:G{$currentRow}");

        $signers = [
            'requested' => [$risSlip->requester, $risSlip->requester_signature_type, (bool) $risSlip->requester],
            'approved' => [$risSlip->approver, $risSlip->approver_signature_type, (bool) $risSlip->approved_by],
            'issued' => [$risSlip->issuer, $risSlip->issuer_signature_type, (bool) $risSlip->issued_by],
            'received' => [$risSlip->receiver, $risSlip->receiver_signature_type, (bool) $risSlip->received_at],
        ];

        foreach ($signers as $step => [$signer, $signatureType, $signed]) {
            $cell = RisSignatureBox::BOXES[$step][0].$currentRow;

            if ($signed && ! ($signatureType === 'esign' && $this->drawSignature($sheet, $risSlip, $step, $signer, $currentRow))) {
                $sheet->setCellValue($cell, 'SGD');
                $sheet->getStyle($cell)->getFont()->setItalic(true)->setBold(true);
            }

            $sheet->getStyle($cell)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER)->setVertical(Alignment::VERTICAL_CENTER);
        }

        $currentRow++;

        // Printed Name row
        $sheet->mergeCells("A{$currentRow}:B{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", 'Printed Name :');
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $names = [
            $risSlip->requester->name ?? '____________________',
            $risSlip->approved_by ? optional($risSlip->approver)->name : '____________________',
            $risSlip->issued_by ? optional($risSlip->issuer)->name : '____________________',
            $risSlip->received_by ? optional($risSlip->receiver)->name : '____________________',
        ];

        // Requested by name (Column C)
        $sheet->setCellValue("C{$currentRow}", $names[0]);
        $sheet->getStyle("C{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("C{$currentRow}")->getFont()->setBold(true);

        // Approved by name (Columns D-E)
        $sheet->mergeCells("D{$currentRow}:E{$currentRow}");
        $sheet->setCellValue("D{$currentRow}", $names[1]);
        $sheet->getStyle("D{$currentRow}:E{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("D{$currentRow}")->getFont()->setBold(true);

        // Issued by name (Columns F-G)
        $sheet->mergeCells("F{$currentRow}:G{$currentRow}");
        $sheet->setCellValue("F{$currentRow}", $names[2]);
        $sheet->getStyle("F{$currentRow}:G{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("F{$currentRow}")->getFont()->setBold(true);

        // Received by name (Column H)
        $sheet->setCellValue("H{$currentRow}", $names[3]);
        $sheet->getStyle("H{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("H{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle("H{$currentRow}")->getFont()->setBold(true);

        $currentRow++;

        // Designation row
        $sheet->mergeCells("A{$currentRow}:B{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", 'Designation :');
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $designations = [
            optional($risSlip->requester)->designation->name ?? 'Designation',
            $risSlip->approved_by ? optional($risSlip->approver)->designation->name ?? 'Designation' : 'Designation',
            $risSlip->issued_by ? optional($risSlip->issuer)->designation->name ?? 'Designation' : 'Designation',
            $risSlip->received_by ? optional($risSlip->receiver)->designation->name ?? 'Designation' : 'Designation',
        ];

        // Requested by designation (Column C)
        $sheet->setCellValue("C{$currentRow}", $designations[0]);
        $sheet->getStyle("C{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Approved by designation (Columns D-E)
        $sheet->mergeCells("D{$currentRow}:E{$currentRow}");
        $sheet->setCellValue("D{$currentRow}", $designations[1]);
        $sheet->getStyle("D{$currentRow}:E{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Issued by designation (Columns F-G)
        $sheet->mergeCells("F{$currentRow}:G{$currentRow}");
        $sheet->setCellValue("F{$currentRow}", $designations[2]);
        $sheet->getStyle("F{$currentRow}:G{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Received by designation (Column H)
        $sheet->setCellValue("H{$currentRow}", $designations[3]);
        $sheet->getStyle("H{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("H{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $currentRow++;

        // Date row
        $sheet->mergeCells("A{$currentRow}:B{$currentRow}");
        $sheet->setCellValue("A{$currentRow}", 'Date :');
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getFont()->setBold(true);
        $sheet->getStyle("A{$currentRow}:B{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("A{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $dates = [
            $risSlip->created_at->format('M d, Y'),
            $risSlip->approved_at ? $risSlip->approved_at->format('M d, Y') : '____________________',
            $risSlip->issued_at ? $risSlip->issued_at->format('M d, Y') : '____________________',
            $risSlip->received_at ? $risSlip->received_at->format('M d, Y') : '____________________',
        ];

        // Requested by date (Column C)
        $sheet->setCellValue("C{$currentRow}", $dates[0]);
        $sheet->getStyle("C{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("C{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Approved by date (Columns D-E)
        $sheet->mergeCells("D{$currentRow}:E{$currentRow}");
        $sheet->setCellValue("D{$currentRow}", $dates[1]);
        $sheet->getStyle("D{$currentRow}:E{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("D{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Issued by date (Columns F-G)
        $sheet->mergeCells("F{$currentRow}:G{$currentRow}");
        $sheet->setCellValue("F{$currentRow}", $dates[2]);
        $sheet->getStyle("F{$currentRow}:G{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("F{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Received by date (Column H)
        $sheet->setCellValue("H{$currentRow}", $dates[3]);
        $sheet->getStyle("H{$currentRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("H{$currentRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Adjust column widths
        $sheet->getColumnDimension('A')->setWidth(12);  // Stock No / Labels
        $sheet->getColumnDimension('B')->setWidth(10);  // Unit
        $sheet->getColumnDimension('C')->setWidth(30);  // Description / Requested by
        $sheet->getColumnDimension('D')->setWidth(10);  // Quantity / Approved by (part 1)
        $sheet->getColumnDimension('E')->setWidth(10);  // Yes / Approved by (part 2)
        $sheet->getColumnDimension('F')->setWidth(10);  // No / Issued by (part 1)
        $sheet->getColumnDimension('G')->setWidth(10);  // Issue Quantity / Issued by (part 2)
        $sheet->getColumnDimension('H')->setWidth(18);  // Remarks / Received by (wider to prevent overflow)

        $filename = 'RIS_'.$risSlip->ris_no.'_'.$risSlip->created_at->format('Y_m_d').'.xlsx';

        return ExcelDownload::response($spreadsheet, $filename);
    }

    /**
     * Puts one signature image in its box on the Excel form. False when
     * there is no image to put (the caller prints "SGD" instead).
     */
    private function drawSignature(Worksheet $sheet, RisSlip $risSlip, string $step, ?User $signer, int $row): bool
    {
        try {
            $frozen = $risSlip->signatures->firstWhere('step', $step);
            $file = Uploads::localPath($frozen->path ?? $signer?->signature_path);
            $size = $file !== null ? getimagesize($file) : false;

            if ($size === false || $size[0] < 1 || $size[1] < 1) {
                return false;
            }

            // Signed before placements were kept: where the export always put it.
            $frame = $frozen !== null
                ? RisSignatureBox::frame($step, ['x' => $frozen->x, 'y' => $frozen->y, 'width' => $frozen->width], $size[0], $size[1])
                : ['left' => 10, 'top' => 5, 'width' => 35 * $size[0] / $size[1], 'height' => 35];

            [$column, $offsetX] = RisSignatureBox::anchor($step, $frame['left']);

            $drawing = new Drawing;
            $drawing->setName(ucfirst($step).' signature');
            $drawing->setDescription(ucfirst($step).' by signature');
            $drawing->setPath($file);
            $drawing->setResizeProportional(false);
            $drawing->setWidth((int) round($frame['width']));
            $drawing->setHeight((int) round($frame['height']));
            $drawing->setCoordinates($column.$row);
            $drawing->setOffsetX($offsetX);
            $drawing->setOffsetY((int) round(max(0, $frame['top'])));
            $drawing->setRotation((int) round($frozen->rotation ?? 0));
            $drawing->setWorksheet($sheet);

            return true;
        } catch (Throwable $exception) {
            report($exception);

            return false;
        }
    }

    public function storeManual(Request $request, ReferenceNumberService $referenceNumberService)
    {
        // Only admin and CAO can create manual entries
        if (! auth()->user()->can('ris.manual-entry')) {
            return back()->with('error', 'Unauthorized to create manual RIS entries.');
        }

        // Simplified validation - no checkbox needed
        $validated = $request->validate([
            'is_manual_entry' => 'required|boolean',
            'ris_date' => [
                'required',
                'date',
                'before_or_equal:today',
                'after_or_equal:'.now()->subYears(5)->format('Y-m-d'),
            ],
            'reference_no' => 'nullable|string|max:255',
            'entity_name' => 'required|string|max:255',
            'division' => 'required|exists:departments,id',
            'office' => 'nullable|string|max:255',
            'fund_cluster' => 'nullable|in:101,151',
            'responsibility_center_code' => 'nullable|string|max:50',
            'requested_by' => 'required|exists:users,id',
            'purpose' => 'nullable|string|max:1000',
            'final_status' => 'required|in:completed,posted,declined',
            'decline_reason' => 'nullable|string|max:500',

            'items' => 'required|array|min:1',
            'items.*.supply_id' => 'required|exists:supplies,supply_id',
            'items.*.quantity_requested' => 'required|integer|min:1',
            'items.*.quantity_issued' => 'nullable|integer|min:0',
            'items.*.remarks' => 'nullable|string|max:500',
        ]);

        // Automatically get current CAO information from database
        $currentCAO = $this->getCurrentCAOUser();

        // If "declined" status, require a reason
        if ($validated['final_status'] === 'declined' && empty($validated['decline_reason'])) {
            return back()->withErrors([
                'decline_reason' => 'Decline reason is required when status is declined.',
            ])->withInput();
        }

        // Check for duplicate items (existing validation)
        if (! empty($validated['reference_no'])) {
            $existingItems = RisSlip::where('ris_no', $validated['reference_no'])
                ->with('items')
                ->get()
                ->flatMap(function ($ris) {
                    return $ris->items->pluck('supply_id');
                })
                ->unique()
                ->toArray();

            $newItems = collect($validated['items'])->pluck('supply_id')->toArray();
            $duplicates = array_intersect($existingItems, $newItems);

            if (count($duplicates) > 0) {
                $itemNames = Supply::whereIn('supply_id', $duplicates)->pluck('item_name')->toArray();
                $duplicateList = implode(', ', $itemNames);

                return back()
                    ->withErrors([
                        'reference_no' => 'This RIS number already has the following item(s): '.$duplicateList.'. Each item can only appear once per RIS number.',
                    ])
                    ->withInput();
            }
        }

        try {
            return \DB::transaction(function () use ($validated, $currentCAO) {
                // Same first-come, first-served lock as a requester's submit.
                $this->lockStockOf(collect($validated['items'])->pluck('supply_id'));

                // Stock validation (keeping existing logic)
                $stockValidationErrors = [];
                foreach ($validated['items'] as $index => $item) {
                    $supplyId = $item['supply_id'];
                    $requestedQty = $item['quantity_requested'];

                    $stock = SupplyStock::where('supply_id', $supplyId)
                        ->where('status', 'available')
                        ->where('quantity_on_hand', '>', 0)
                        ->first();

                    if (! $stock) {
                        $supply = Supply::find($supplyId);
                        $stockValidationErrors[] = [
                            'supply_name' => $supply ? $supply->item_name : 'Unknown',
                            'message' => 'No IAR found for this supply. Cannot request items without inventory record.',
                        ];

                        continue;
                    }

                    $pendingRequested = RisItem::where('supply_id', $supplyId)
                        ->whereHas('risSlip', function ($q) {
                            $q->whereIn('status', ['draft', 'approved']);
                        })
                        ->sum('quantity_requested');

                    $currentAvailable = max(0, $stock->quantity_on_hand - $pendingRequested);

                    if ($requestedQty > $currentAvailable) {
                        $supply = Supply::find($supplyId);
                        $stockValidationErrors[] = [
                            'supply_name' => $supply ? $supply->item_name : 'Unknown',
                            'requested' => $requestedQty,
                            'available' => $currentAvailable,
                            'message' => "Insufficient stock. Available: {$currentAvailable}, Requested: {$requestedQty}",
                        ];
                    }
                }

                if (! empty($stockValidationErrors)) {
                    $stockMessages = collect($stockValidationErrors)
                        ->map(fn ($error) => "{$error['supply_name']}: {$error['message']}")
                        ->implode(' ');

                    return back()
                        ->withErrors(['stock_validation' => $stockMessages])
                        ->with('error', 'Cannot create RIS: Stock validation failed.')
                        ->withInput();
                }

                // Prepare and Save RIS Slip
                $risDate = Carbon::parse($validated['ris_date']);
                $newRisNumber = $validated['reference_no'] ?? $this->generateHistoricalRisNumber($risDate);

                $risSlip = RisSlip::create([
                    'ris_no' => $newRisNumber,
                    'ris_date' => $risDate,
                    'entity_name' => $validated['entity_name'],
                    'division' => $validated['division'],
                    'office' => $validated['office'],
                    'fund_cluster' => $validated['fund_cluster'],
                    'responsibility_center_code' => $validated['responsibility_center_code'],
                    'requested_by' => $validated['requested_by'],
                    'requester_signature_type' => 'sgd',
                    'purpose' => $validated['purpose'] ?? null,
                    'status' => 'draft',

                    // MANUAL ENTRY FIELDS
                    'is_manual_entry' => true,
                    'reference_source' => $validated['reference_no'] ?? null,
                    'manual_entry_by' => auth()->id(),
                    'manual_entry_at' => now(),
                    'manual_entry_notes' => "Historical entry for {$risDate->format('M d, Y')}",

                    // AUTOMATIC CAO INFORMATION
                    'cao_name' => $currentCAO['name'],
                    'cao_designation' => $currentCAO['designation'],

                    // Set historical timestamps
                    'created_at' => $risDate,
                    'updated_at' => $risDate,
                ]);

                // RIS Items
                foreach ($validated['items'] as $item) {
                    RisItem::create([
                        'ris_id' => $risSlip->ris_id,
                        'supply_id' => $item['supply_id'],
                        'quantity_requested' => $item['quantity_requested'],
                        'quantity_issued' => $item['quantity_issued'] ?? 0,
                        'stock_available' => true,
                        'remarks' => $item['remarks'] ?? null,
                        'created_at' => $risDate,
                        'updated_at' => $risDate,
                    ]);
                }

                // Apply historical status with automatic requester as receiver
                $this->applyHistoricalStatusWithAutoReceiver($risSlip, $validated, $risDate, $currentCAO);

                // Audit log
                \Log::info('Manual RIS entry created', [
                    'ris_no' => $newRisNumber,
                    'ris_date' => $risDate->format('Y-m-d'),
                    'created_by' => auth()->id(),
                    'created_by_name' => auth()->user()->name,
                    'requested_by' => $validated['requested_by'],
                    'final_status' => $validated['final_status'],
                    'cao_name' => $currentCAO['name'],
                    'cao_designation' => $currentCAO['designation'],
                    'cao_id' => $currentCAO['id'],
                    'items_count' => count($validated['items']),
                ]);

                RisActivity::record(
                    ActivityAction::Created,
                    $risSlip,
                    summary: 'Manual entry · '.ucfirst($validated['final_status']).' · '.count($validated['items']).' '.Str::plural('item', count($validated['items'])),
                    properties: ['manual_entry' => true, 'final_status' => $validated['final_status'], 'ris_date' => $risDate->toDateString()],
                    withStock: $validated['final_status'] !== 'declined',
                );

                return redirect()
                    ->route('ris.index')
                    ->with('success', "Manual RIS {$newRisNumber} created successfully for date {$risDate->format('M d, Y')}.");
            }, 3); // retried if it deadlocks with another request on the stock lock

        } catch (\Exception $e) {
            \Log::error('Failed to create manual RIS', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return back()
                ->with('error', 'Failed to create manual RIS: '.$e->getMessage())
                ->withInput();
        }
    }

    /**
     * AJAX: current CAO details (the route existed in the Jetstream version
     * but the method was missing, so it always returned an error).
     */
    public function getCurrentCAO()
    {
        return response()->json($this->getCurrentCAOUser());
    }

    /**
     * Get current CAO user information from database
     */
    /** The CAO who signs RIS forms (Settings › RIS signatory, with the old fallbacks). */
    private function getCurrentCAOUser()
    {
        return RisSignatory::current();
    }

    private function applyHistoricalStatusWithAutoReceiver(RisSlip $risSlip, array $validated, Carbon $risDate, array $caoInfo)
    {
        $currentUserId = auth()->id(); // Current user for issued/received
        $caoUserId = $caoInfo['id'];

        // If no CAO user found, create one or use current user as fallback for approval
        if (! $caoUserId) {
            $caoUserId = $this->getOrCreateCAOUserRecord($caoInfo);
        }

        switch ($validated['final_status']) {
            case 'declined':
                $risSlip->update([
                    'status' => RisStatus::DECLINED,
                    'declined_by' => $caoUserId, // Use CAO for decline
                    'declined_at' => $risDate,
                    'decline_reason' => $validated['decline_reason'],
                    'updated_at' => $risDate,
                ]);
                break;

            case 'posted':
                $risSlip->update([
                    'status' => RisStatus::POSTED,
                    'approved_by' => $caoUserId,        // ← CAO for approval
                    'approved_at' => $risDate,
                    'approver_signature_type' => 'sgd',
                    'issued_by' => $currentUserId,      // ← CURRENT USER for issued
                    'issued_at' => $risDate,
                    'issuer_signature_type' => 'sgd',
                    'updated_at' => $risDate,
                ]);

                $this->processHistoricalStockDeductions($risSlip, $risDate);
                break;

            case 'completed':
                $risSlip->update([
                    'status' => RisStatus::POSTED,
                    'approved_by' => $caoUserId,                    // ← CAO for approval
                    'approved_at' => $risDate,
                    'approver_signature_type' => 'sgd',
                    'issued_by' => $currentUserId,                  // ← CURRENT USER for issued
                    'issued_at' => $risDate,
                    'issuer_signature_type' => 'sgd',
                    'received_by' => $validated['requested_by'],    // ← AUTOMATICALLY use requester as receiver
                    'received_at' => $risDate,
                    'receiver_signature_type' => 'sgd',
                    'updated_at' => $risDate,
                ]);

                $this->processHistoricalStockDeductions($risSlip, $risDate);
                break;
        }
    }

    // /**
    //  * Apply historical status with CAO ONLY for approval part
    //  */
    // private function applyHistoricalStatusWithCAO(RisSlip $risSlip, array $validated, Carbon $risDate, array $caoInfo)
    // {
    //     $currentUserId = auth()->id(); // Current user for issued/received
    //     $caoUserId = $caoInfo['id'];

    //     // If no CAO user found, create one or use current user as fallback for approval
    //     if (!$caoUserId) {
    //         $caoUserId = $this->getOrCreateCAOUserRecord($caoInfo);
    //     }

    //     switch ($validated['final_status']) {
    //         case 'declined':
    //             $risSlip->update([
    //                 'status' => RisStatus::DECLINED,
    //                 'declined_by' => $caoUserId, // Use CAO for decline
    //                 'declined_at' => $risDate,
    //                 'decline_reason' => $validated['decline_reason'],
    //                 'updated_at' => $risDate,
    //             ]);
    //             break;

    //         case 'posted':
    //             $risSlip->update([
    //                 'status' => RisStatus::POSTED,
    //                 'approved_by' => $caoUserId,        // ← CAO for approval
    //                 'approved_at' => $risDate,
    //                 'approver_signature_type' => 'sgd',
    //                 'issued_by' => $currentUserId,      // ← CURRENT USER for issued
    //                 'issued_at' => $risDate,
    //                 'issuer_signature_type' => 'sgd',
    //                 'updated_at' => $risDate,
    //             ]);

    //             $this->processHistoricalStockDeductions($risSlip, $risDate);
    //             break;

    //         case 'completed':
    //             // Determine receiver: use requester if checkbox checked, otherwise use CURRENT USER
    //             $receiverId = $validated['same_as_requester']
    //                 ? $validated['requested_by']
    //                 : $currentUserId; // ← CURRENT USER, not CAO

    //             $risSlip->update([
    //                 'status' => RisStatus::POSTED,
    //                 'approved_by' => $caoUserId,        // ← CAO for approval
    //                 'approved_at' => $risDate,
    //                 'approver_signature_type' => 'sgd',
    //                 'issued_by' => $currentUserId,      // ← CURRENT USER for issued
    //                 'issued_at' => $risDate,
    //                 'issuer_signature_type' => 'sgd',
    //                 'received_by' => $receiverId,       // ← CURRENT USER or requester
    //                 'received_at' => $risDate,
    //                 'receiver_signature_type' => 'sgd',
    //                 'updated_at' => $risDate,
    //             ]);

    //             $this->processHistoricalStockDeductions($risSlip, $risDate);
    //             break;
    //     }
    // }

    /**
     * Create CAO user record if needed
     */
    private function getOrCreateCAOUserRecord(array $caoInfo)
    {
        try {
            $caoUser = User::where('name', $caoInfo['name'])->first();

            if (! $caoUser) {
                $caoUser = User::create([
                    'name' => $caoInfo['name'],
                    'email' => $caoInfo['email'],
                    'email_verified_at' => now(),
                    'password' => Hash::make(Str::random(32)),
                    'position' => $caoInfo['designation'],
                    'role' => 'cao',
                    'status' => 1,
                ]);
            }

            return $caoUser->id;

        } catch (\Exception $e) {
            \Log::error('Failed to create CAO user record', [
                'error' => $e->getMessage(),
            ]);

            return auth()->id();
        }
    }

    /**
     * Generate unique RIS number for historical dates - handles gaps properly
     */
    private function generateHistoricalRisNumber(Carbon $date): string
    {
        $year = $date->format('Y');
        $month = $date->format('m');
        $pattern = "RIS {$year}-{$month}-";

        $existingNumbers = RisSlip::where('ris_no', 'like', $pattern.'%')
            ->pluck('ris_no')
            ->map(function ($risNo) use ($pattern) {
                $numberPart = str_replace($pattern, '', $risNo);

                return intval($numberPart);
            })
            ->filter(function ($num) {
                return $num > 0;
            })
            ->sort()
            ->values();

        $next = $existingNumbers->isEmpty() ? 1 : $existingNumbers->max() + 1;

        return sprintf('RIS %s-%s-%03d', $year, $month, $next);
    }

    /**
     * Apply historical status to manually created RIS - ENHANCED VERSION
     */
    private function applyHistoricalStatus(RisSlip $risSlip, array $validated, Carbon $risDate)
    {
        $currentUserId = auth()->id();

        switch ($validated['final_status']) {
            case 'declined':
                $risSlip->update([
                    'status' => RisStatus::DECLINED,
                    'declined_by' => $currentUserId,
                    'declined_at' => $risDate,
                    'decline_reason' => $validated['decline_reason'],
                    'updated_at' => $risDate,
                ]);

                // Log decline
                Log::info('Manual RIS declined', [
                    'ris_no' => $risSlip->ris_no,
                    'reason' => $validated['decline_reason'],
                    'declined_by' => auth()->user()->name,
                ]);
                break;

            case 'posted':
                // Approved -> Issued (Pending Receipt)
                $risSlip->update([
                    'status' => RisStatus::POSTED,
                    'approved_by' => $currentUserId,
                    'approved_at' => $risDate,
                    'approver_signature_type' => 'sgd',
                    'issued_by' => $currentUserId,
                    'issued_at' => $risDate,
                    'issuer_signature_type' => 'sgd',
                    'updated_at' => $risDate,
                ]);

                // Process stock deductions for issued items
                $this->processHistoricalStockDeductions($risSlip, $risDate);

                Log::info('Manual RIS issued', [
                    'ris_no' => $risSlip->ris_no,
                    'issued_by' => auth()->user()->name,
                ]);
                break;

            case 'completed':
                // Approved -> Issued -> Received (Completed)
                $risSlip->update([
                    'status' => RisStatus::POSTED,
                    'approved_by' => $currentUserId,
                    'approved_at' => $risDate,
                    'approver_signature_type' => 'sgd',
                    'issued_by' => $currentUserId,
                    'issued_at' => $risDate,
                    'issuer_signature_type' => 'sgd',
                    'received_by' => $validated['requested_by'], // Set receiver as the requester
                    'received_at' => $risDate,
                    'receiver_signature_type' => 'sgd',
                    'updated_at' => $risDate,
                ]);

                // Process stock deductions for completed items
                $this->processHistoricalStockDeductions($risSlip, $risDate);

                Log::info('Manual RIS completed', [
                    'ris_no' => $risSlip->ris_no,
                    'completed_by' => auth()->user()->name,
                    'received_by' => User::find($validated['requested_by'])->name ?? 'Unknown',
                ]);
                break;
        }
    }

    private function processHistoricalStockDeductions(RisSlip $risSlip, Carbon $risDate)
    {
        foreach ($risSlip->items as $item) {
            $issueQty = $item->quantity_issued;

            if ($issueQty > 0) {
                $matchingStocks = SupplyStock::where('supply_id', $item->supply_id)
                    ->where('status', 'available')
                    ->where('quantity_on_hand', '>', 0)
                    ->orderBy('expiry_date', 'asc')
                    ->orderBy('created_at', 'asc')
                    ->get();

                $remainingQuantity = $issueQty;

                foreach ($matchingStocks as $stock) {
                    if ($remainingQuantity <= 0) {
                        break;
                    }

                    $qtyToDeduct = min($remainingQuantity, $stock->quantity_on_hand);
                    $stock->quantity_on_hand -= $qtyToDeduct;
                    $stockItemCost = $qtyToDeduct * $stock->unit_cost;

                    if ($stock->quantity_on_hand <= 0) {
                        $stock->status = 'depleted';
                    }
                    $stock->save();

                    SupplyTransaction::create([
                        'supply_id' => $item->supply_id,
                        'transaction_type' => 'issue',
                        'transaction_date' => $risDate->toDateString(),
                        'reference_no' => $risSlip->ris_no,
                        'quantity' => $qtyToDeduct,
                        'unit_cost' => $stock->unit_cost,
                        'total_cost' => $stockItemCost,
                        'department_id' => $risSlip->division,
                        'user_id' => auth()->id(),
                        'remarks' => "Historical issue via RIS #{$risSlip->ris_no}",
                        'fund_cluster' => $risSlip->fund_cluster,
                        'balance_quantity' => $stock->quantity_on_hand,
                        'balance_unit_cost' => $stock->unit_cost,
                        'balance_total_cost' => $stock->quantity_on_hand * $stock->unit_cost,
                        'created_at' => $risDate,
                        'updated_at' => $risDate,
                    ]);

                    $remainingQuantity -= $qtyToDeduct;
                }
            }
        }
    }

    /**
     * AJAX: Get all active supplies (even if quantity_on_hand == 0)
     */
    public function getAvailableSupplies(Request $request)
    {
        if (! auth()->user()->can('ris.manual-entry')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $supplies = Supply::where('is_active', true)
            ->orderBy('item_name')
            ->get()
            ->map(function ($supply) {
                // total on‐hand, even if zero
                $available = SupplyStock::getTotalAvailableQuantity($supply->supply_id);

                return [
                    'supply_id' => $supply->supply_id,
                    'stock_no' => $supply->stock_no,
                    'item_name' => $supply->item_name,
                    'description' => $supply->description,
                    'unit_of_measurement' => $supply->unit_of_measurement,
                    'available_quantity' => $available,
                ];
            });

        return response()->json(['supplies' => $supplies]);
    }

    public function validateManualStock(Request $request)
    {
        $data = $request->validate([
            'ris_date' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.supply_id' => 'required|exists:supplies,supply_id',
        ]);

        $risDate = Carbon::parse($data['ris_date'])->endOfDay();
        $availabilities = [];

        foreach ($data['items'] as $item) {
            $supplyId = $item['supply_id'];

            $received = SupplyTransaction::where('supply_id', $supplyId)
                ->where('transaction_type', 'receipt')
                ->whereDate('transaction_date', '<=', $risDate)
                ->sum('quantity');

            $issued = SupplyTransaction::where('supply_id', $supplyId)
                ->where('transaction_type', 'issue')
                ->whereDate('transaction_date', '<=', $risDate)
                ->sum('quantity');

            $availabilities[$supplyId] = max(0, $received - $issued);
        }

        return response()->json([
            'success' => true,
            'current_availability' => $availabilities,
        ]);
    }

    public function nextRis(Request $request)
    {
        $data = $request->validate([
            'ris_date' => 'required|date',
        ]);

        try {
            $date = Carbon::parse($data['ris_date']);
            $defaultRis = $this->generateHistoricalRisNumber($date);

            return response()->json([
                'success' => true,
                'defaultRis' => $defaultRis,
                'date' => $date->format('Y-m-d'),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to generate RIS number: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get department details for auto-filling office field
     */
    public function getDepartmentDetails(Request $request)
    {
        $departmentId = $request->get('department_id');

        \Log::info('getDepartmentDetails called', ['department_id' => $departmentId]);

        if (! $departmentId) {
            return response()->json(['office' => '', 'debug' => 'No department ID provided']);
        }

        $department = Department::find($departmentId);

        if (! $department) {
            return response()->json(['office' => '', 'debug' => 'Department not found']);
        }

        // Check what fields your department has
        \Log::info('Department found', ['department' => $department->toArray()]);

        // Try different approaches
        $office = $department->office ?? $department->name ?? '';

        return response()->json([
            'office' => $office,
            'debug' => 'Success',
            'department_name' => $department->name,
            'department_data' => $department->toArray(),
        ]);
    }
}
