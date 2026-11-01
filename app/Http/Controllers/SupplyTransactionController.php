<?php

namespace App\Http\Controllers;

use App\Actions\Transactions\CorrectTransaction;
use App\Actions\Transactions\DeleteTransaction;
use App\Actions\Transactions\RenumberIar;
use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Http\Requests\Transactions\DeleteSupplyTransactionRequest;
use App\Http\Requests\Transactions\RenumberIarRequest;
use App\Http\Requests\Transactions\UpdateSupplyTransactionRequest;
use App\Models\Department;
use App\Models\RisSlip;
use App\Models\Supply;
use App\Models\SupplyStock;
use App\Models\SupplyTransaction;
use App\Models\User;
use App\Services\ActivityRecorder;
use App\Services\ReferenceNumberService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SupplyTransactionController extends Controller
{
    /**
     * Transactions, two ways: "documents" (default) shows one row per IAR/RIS
     * reference with its item lines inside; "lines" shows one row per item
     * line, as before. Both sort by transaction date, newest first.
     */
    public function index(Request $request)
    {
        $request->validate([
            'view' => 'nullable|in:documents,lines',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'type' => 'nullable|in:receipt,issue,adjustment',
            'search' => 'nullable|string|max:100',
            'division' => 'nullable|integer',
            'fund' => 'nullable|string|max:20',
        ]);

        $view = $request->query('view') === 'lines' ? 'lines' : 'documents';
        $search = trim((string) $request->query('search', ''));

        // The same filters for both views, applied to item lines.
        $filter = function ($query) use ($request, $search) {
            if ($request->filled('from')) {
                $query->whereDate('supply_transactions.transaction_date', '>=', $request->from);
            }
            if ($request->filled('to')) {
                $query->whereDate('supply_transactions.transaction_date', '<=', $request->to);
            }
            if ($request->filled('type')) {
                $query->where('supply_transactions.transaction_type', $request->type);
            }
            if ($request->filled('division')) {
                $query->where('supply_transactions.department_id', $request->division);
            }
            if ($request->filled('fund')) {
                $query->where('supply_transactions.fund_cluster', $request->fund);
            }
            if ($search !== '') {
                $query->where(function ($query) use ($search) {
                    $query->where('supply_transactions.reference_no', 'like', "%{$search}%")
                        ->orWhereHas('supply', fn ($supply) => $supply
                            ->where('item_name', 'like', "%{$search}%")
                            ->orWhere('stock_no', 'like', "%{$search}%"));
                });
            }

            return $query;
        };

        $props = [
            'view' => $view,
            'filters' => [
                'from' => $request->query('from'),
                'to' => $request->query('to'),
                'type' => $request->query('type'),
                'search' => $search !== '' ? $search : null,
                'division' => $request->query('division'),
                'fund' => $request->query('fund'),
            ],
            'divisions' => Department::query()->orderBy('name')->get(['id', 'name']),
            'fundClusters' => SupplyTransaction::query()->whereNotNull('fund_cluster')->distinct()->orderBy('fund_cluster')->pluck('fund_cluster'),
            'totals' => ['lines' => $filter(SupplyTransaction::query())->count()],
        ];

        if ($view === 'lines') {
            $props['txns'] = $filter(SupplyTransaction::with(['supply', 'department', 'user']))
                ->orderByDesc('transaction_date')
                ->orderByDesc('created_at')
                ->orderByDesc('transaction_id')
                ->paginate(25)
                ->withQueryString();

            return Inertia::render('transactions/index', $props);
        }

        $filtered = collect($props['filters'])->filter(fn ($value) => $value !== null && $value !== '')->isNotEmpty();
        $props['documents'] = $this->documents($filter, $filtered);
        $props['totals']['documents'] = $props['documents']->total();

        return Inertia::render('transactions/index', $props);
    }

    /**
     * One row per document: lines sharing a type and reference number (an IAR
     * or an RIS). A document is listed when any of its lines matches the
     * filters, and its totals count all of its lines.
     */
    private function documents(callable $filter, bool $filtered)
    {
        $documents = DB::table('supply_transactions');

        if ($filtered) {
            // The documents with at least one matching line. Reference numbers
            // carry their type (RIS…, IAR…), so type + number pick them out.
            $matches = $filter(SupplyTransaction::query())
                ->select(['supply_transactions.transaction_type', 'supply_transactions.reference_no'])
                ->distinct()
                ->toBase()
                ->get();

            if ($matches->isEmpty()) {
                $documents->whereRaw('1 = 0');
            } else {
                $references = $matches->pluck('reference_no')->filter()->unique()->values();
                $documents
                    ->whereIn('supply_transactions.transaction_type', $matches->pluck('transaction_type')->unique()->values())
                    ->where(function ($query) use ($references, $matches) {
                        $query->whereIn('supply_transactions.reference_no', $references);

                        if ($matches->contains(fn ($match) => $match->reference_no === null)) {
                            $query->orWhereNull('supply_transactions.reference_no');
                        }
                    });
            }
        }

        $documents = $documents
            ->selectRaw(implode(', ', [
                'supply_transactions.transaction_type',
                'supply_transactions.reference_no',
                'MIN(supply_transactions.transaction_date) as date_from',
                'MAX(supply_transactions.transaction_date) as date_to',
                'COUNT(*) as line_count',
                'COUNT(DISTINCT supply_transactions.supply_id) as item_count',
                'SUM(supply_transactions.total_cost) as total_value',
                'MAX(supply_transactions.created_at) as recorded_at',
                'COUNT(DISTINCT supply_transactions.department_id) as division_count',
                'MAX(supply_transactions.department_id) as department_id',
                'MAX(supply_transactions.user_id) as user_id',
                'MAX(supply_transactions.fund_cluster) as fund_cluster',
            ]))
            ->groupBy('supply_transactions.transaction_type', 'supply_transactions.reference_no')
            ->orderByRaw('MAX(supply_transactions.transaction_date) DESC, MAX(supply_transactions.created_at) DESC, MAX(supply_transactions.transaction_id) DESC')
            ->paginate(25)
            ->withQueryString();

        $page = collect($documents->items());

        // The item lines of the documents on this page, in one query.
        $lines = $page->isEmpty() ? collect() : SupplyTransaction::with([
            'supply:supply_id,stock_no,item_name,unit_of_measurement',
            'department:id,name',
            'user:id,name',
        ])
            ->where(function ($query) use ($page) {
                foreach ($page as $document) {
                    $query->orWhere(fn ($line) => $line
                        ->where('transaction_type', $document->transaction_type)
                        ->where('reference_no', $document->reference_no));
                }
            })
            ->orderBy('transaction_date')
            ->orderBy('transaction_id')
            ->get()
            ->groupBy(fn (SupplyTransaction $line) => $line->transaction_type.'|'.($line->reference_no ?? ''));

        $divisions = Department::query()->whereIn('id', $page->pluck('department_id')->filter())->pluck('name', 'id');
        $users = User::query()->whereIn('id', $page->pluck('user_id')->filter())->pluck('name', 'id');
        // Issue references are RIS numbers: link them to the RIS page.
        $risKeys = RisSlip::query()
            ->whereIn('ris_no', $page->where('transaction_type', SupplyTransaction::ISSUE)->pluck('reference_no')->filter())
            ->get(['ris_id', 'ris_no'])
            ->mapWithKeys(fn (RisSlip $slip) => [$slip->ris_no => $slip->route_key]);

        return $documents->through(fn ($document) => [
            'key' => $document->transaction_type.'|'.($document->reference_no ?? ''),
            'transaction_type' => $document->transaction_type,
            'reference_no' => $document->reference_no ?: null,
            'date_from' => $document->date_from,
            'date_to' => $document->date_to,
            'line_count' => (int) $document->line_count,
            'item_count' => (int) $document->item_count,
            'total_value' => (float) $document->total_value,
            'recorded_at' => $document->recorded_at ? Carbon::parse($document->recorded_at)->toIso8601String() : null,
            'multiple_divisions' => (int) $document->division_count > 1,
            'division' => (int) $document->division_count > 1 ? null : ($divisions[$document->department_id] ?? null),
            'fund_cluster' => $document->fund_cluster,
            'recorded_by' => $users[$document->user_id] ?? null,
            'ris_key' => $risKeys[$document->reference_no] ?? null,
            'lines' => ($lines[$document->transaction_type.'|'.($document->reference_no ?? '')] ?? collect())
                ->map(fn (SupplyTransaction $line) => $this->lineData($line))
                ->values(),
        ]);
    }

    public function store(Request $request, ReferenceNumberService $referenceNumberService)
    {
        /* 1 ▸ Validate input */
        $data = $request->validate([
            'supply_id' => 'required|exists:supplies,supply_id',
            'transaction_type' => 'required|in:receipt,issue,adjustment',
            'transaction_date' => 'required|date',
            'reference_no' => 'nullable|string', // Changed to nullable
            'quantity' => 'required|integer|min:0',   // qty 0 allowed for adjustment
            'unit_cost' => 'required|numeric|min:0',
            'department_id' => 'nullable|exists:departments,id', // CHANGED TO NULLABLE
            'remarks' => 'nullable|string',
            'requested_by' => 'nullable|exists:users,id',  // Added for requester
            'received_by' => 'nullable|exists:users,id',  // Added for receiver
            'fund_cluster' => 'nullable|string', // Added for fund cluster
            'days_to_consume' => 'nullable|integer', // Added for days to consume
            'ris_id' => 'nullable|exists:ris_slips,ris_id', // Add this to link with RIS slip
        ]);

        /* Generate reference number if not provided */
        if (empty($data['reference_no'])) {
            if ($data['transaction_type'] === 'receipt') {
                // Generate IAR number for receipt transactions
                $data['reference_no'] = $referenceNumberService->generateIarNumber($data['supply_id']);
            } elseif ($data['transaction_type'] === 'issue') {
                // Use RIS number from the RIS slip if available, or generate a new one
                if (! empty($data['ris_id'])) {
                    $risSlip = RisSlip::find($data['ris_id']);
                    $data['reference_no'] = $risSlip->ris_no;
                } else {
                    $data['reference_no'] = $referenceNumberService->generateRisNumber();
                }
            }
        }

        /* ▲ NEW: record who performed the transaction */
        $data['user_id'] = auth()->id();

        // IMPORTANT: Only set department_id if it's actually provided and not empty
        if (empty($data['department_id'])) {
            unset($data['department_id']);
        }

        /* 2 ▸ Lock summary row */
        $stock = SupplyStock::where('supply_id', $data['supply_id'])
            ->lockForUpdate()
            ->firstOrFail();

        /* 3 ▸ Derived values */
        $data['total_cost'] = $data['unit_cost'] * $data['quantity'];

        $deltaQty = match ($data['transaction_type']) {
            SupplyTransaction::RECEIPT => $data['quantity'],
            SupplyTransaction::ISSUE => -$data['quantity'],
            SupplyTransaction::ADJUSTMENT => 0,
        };

        $newQty = $stock->quantity_on_hand + $deltaQty;
        if ($newQty < 0) {
            return back()->withErrors('Issuance would make quantity negative.');
        }

        $newUnitCost = match ($data['transaction_type']) {
            SupplyTransaction::RECEIPT => $newQty ? ($stock->total_cost + $data['total_cost']) / $newQty
                        : $stock->unit_cost,
            SupplyTransaction::ISSUE => $stock->unit_cost,
            SupplyTransaction::ADJUSTMENT => $data['unit_cost'],
        };

        /* 4 ▸ Atomic save */
        DB::transaction(function () use ($data, $stock, $newQty, $newUnitCost) {
            $data['balance_quantity'] = $newQty;

            // Create the transaction
            $transaction = SupplyTransaction::create($data);   // now includes user_id

            // Link transaction to requester if provided
            if (! empty($data['requested_by'])) {
                $transaction->users()->attach($data['requested_by'], ['role' => 'requester']);
            }

            // Link transaction to receiver if provided
            if (! empty($data['received_by'])) {
                $transaction->users()->attach($data['received_by'], ['role' => 'receiver']);
            }

            $stock->update([
                'quantity_on_hand' => $newQty,
                'unit_cost' => $newUnitCost,
                'total_cost' => $newQty * $newUnitCost,
            ]);

            $transaction->loadMissing('supply');
            app(ActivityRecorder::class)->record(
                match ($data['transaction_type']) {
                    SupplyTransaction::RECEIPT => ActivityAction::Recorded,
                    SupplyTransaction::ISSUE => ActivityAction::Issued,
                    default => ActivityAction::Adjusted,
                },
                ActivityModule::Transactions,
                $transaction,
                properties: [
                    'item' => $transaction->supply ? "{$transaction->supply->item_name} ({$transaction->supply->stock_no})" : null,
                    'type' => $data['transaction_type'],
                    'quantity' => (int) $data['quantity'],
                    'unit_cost' => (float) $data['unit_cost'],
                    'balance_after' => $newQty,
                ],
                summary: ucfirst($data['transaction_type']).' · '.($transaction->supply->item_name ?? 'Supply').' · qty '.$data['quantity'],
            );
        });

        return back()->with('success', 'Transaction recorded successfully.');
    }

    /**
     * Corrects a recorded receipt or issue line (admins; a reason is
     * required). Stock on hand, later balances and the RIS follow.
     */
    public function update(UpdateSupplyTransactionRequest $request, SupplyTransaction $transaction, CorrectTransaction $correct): RedirectResponse
    {
        $changed = $correct->handle($transaction, $request->validated(), (string) $request->validated('reason'));

        return $changed
            ? back()->with('success', "Transaction #{$transaction->getKey()} updated.")
            : back()->with('info', 'Nothing was changed.');
    }

    /** Deletes a receipt or issue line recorded by mistake (admins; with a reason). */
    public function destroy(DeleteSupplyTransactionRequest $request, SupplyTransaction $transaction, DeleteTransaction $delete): RedirectResponse
    {
        $delete->handle($transaction, (string) $request->validated('reason'));

        return back()->with('deleted', "Transaction #{$transaction->getKey()} deleted.");
    }

    /** Gives a whole IAR (all its receipt lines) a corrected number. */
    public function renumber(RenumberIarRequest $request, RenumberIar $renumber): RedirectResponse
    {
        $from = (string) $request->validated('from');
        $to = (string) $request->validated('to');
        $count = $renumber->handle($from, $to, (string) $request->validated('reason'));

        return back()->with('success', "{$from} changed to {$to}: {$count} ".($count === 1 ? 'line' : 'lines').' updated.');
    }

    /**
     * An item line with only what the page shows (the full user and supply
     * records made each line ~1 KB, slowing pages with large documents).
     *
     * @return array<string, mixed>
     */
    private function lineData(SupplyTransaction $line): array
    {
        return [
            'transaction_id' => $line->transaction_id,
            'supply_id' => $line->supply_id,
            'transaction_type' => $line->transaction_type,
            'transaction_date' => $line->transaction_date?->format('Y-m-d'),
            'reference_no' => $line->reference_no,
            'quantity' => $line->quantity,
            'unit_cost' => $line->unit_cost,
            'total_cost' => $line->total_cost,
            'balance_quantity' => $line->balance_quantity,
            'fund_cluster' => $line->fund_cluster,
            'remarks' => $line->remarks,
            'created_at' => $line->created_at?->toIso8601String(),
            'supply' => $line->supply?->only(['supply_id', 'stock_no', 'item_name', 'unit_of_measurement']),
            'department' => $line->department?->only(['id', 'name']),
            'user' => $line->user?->only(['id', 'name']),
        ];
    }
}
