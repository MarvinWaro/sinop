<?php

namespace App\Services;

use App\Models\SupplyTransaction;
use Carbon\Carbon;

/**
 * RSMI cost and yearly analytics, shared by the RSMI pages and the admin
 * dashboard. Moved unchanged from ReportSuppliesMaterialsIssuedController;
 * the only addition is the semester split in yearly().
 */
class RsmiAnalyticsService
{
    public function correctUnitCosts($transactions, $fundCluster)
    {
        // Group transactions by supply to calculate moving average for each
        $transactionsBySupply = $transactions->groupBy('supply_id');
        $correctedTransactions = collect();

        foreach ($transactionsBySupply as $supplyId => $supplyTransactions) {
            // CRITICAL: Get ALL transactions for this supply to calculate accurate moving average
            // This is EXACTLY how Supply Ledger Card does it
            $allTransactions = SupplyTransaction::where('supply_id', $supplyId)
                ->orderBy('transaction_date')
                ->orderBy('created_at')  // Same ordering as Supply Ledger Card
                ->get();

            // Initialize running totals (same as Supply Ledger Card)
            $runningBalance = 0;
            $runningTotalCost = 0;
            $movingAverageCosts = [];

            // Process ALL transactions to build accurate moving average history
            foreach ($allTransactions as $transaction) {
                if ($transaction->transaction_type == 'receipt') {
                    // For receipts: add to running totals
                    $runningBalance += $transaction->quantity;
                    $runningTotalCost += $transaction->total_cost; // Use total_cost from transaction

                } elseif ($transaction->transaction_type == 'issue') {
                    // EXACT SAME LOGIC as Supply Ledger Card:
                    // Calculate weighted average BEFORE the issue
                    $weightedAverageUnitCost = $runningBalance > 0
                        ? $runningTotalCost / $runningBalance
                        : 0;

                    // Store the moving average cost for this specific transaction
                    $movingAverageCosts[$transaction->transaction_id] = $weightedAverageUnitCost;

                    // Update running totals AFTER calculating the cost (same as Supply Ledger Card)
                    $costToDeduct = $weightedAverageUnitCost * $transaction->quantity;
                    $runningBalance -= $transaction->quantity;
                    $runningTotalCost = max(0, $runningTotalCost - $costToDeduct);

                } else {
                    // For adjustments (same as Supply Ledger Card logic)
                    $runningBalance = $transaction->balance_quantity;
                    if ($runningBalance > 0 && $transaction->unit_cost) {
                        $runningTotalCost = $runningBalance * $transaction->unit_cost;
                    }
                }
            }

            // Apply the calculated moving average costs to our monthly report transactions
            foreach ($supplyTransactions as $transaction) {
                if ($transaction->transaction_type == 'issue' && isset($movingAverageCosts[$transaction->transaction_id])) {
                    // Use the pre-calculated moving average cost (same as Supply Ledger Card)
                    $correctedUnitCost = $movingAverageCosts[$transaction->transaction_id];
                    $transaction->corrected_unit_cost = $correctedUnitCost;
                    $transaction->corrected_total_cost = $correctedUnitCost * $transaction->quantity;
                } elseif ($transaction->transaction_type == 'receipt') {
                    // For receipts, use the actual transaction values (same as Supply Ledger Card)
                    $transaction->corrected_unit_cost = $transaction->unit_cost;
                    $transaction->corrected_total_cost = $transaction->total_cost;
                } else {
                    // Fallback to original values
                    $transaction->corrected_unit_cost = $transaction->unit_cost;
                    $transaction->corrected_total_cost = $transaction->total_cost;
                }

                $correctedTransactions->push($transaction);
            }
        }

        return $correctedTransactions;
    }

    public function yearly($year, $fundCluster)
    {
        $startDate = Carbon::createFromDate($year, 1, 1)->startOfYear();
        $endDate = Carbon::createFromDate($year, 12, 31)->endOfYear();

        // Get all transactions for the year
        $transactions = SupplyTransaction::with(['supply.category', 'department'])
            ->where('transaction_type', 'issue')
            ->whereBetween('transaction_date', [$startDate, $endDate])
            ->whereHas('supply.stocks', function ($q) use ($fundCluster) {
                $q->where('fund_cluster', $fundCluster);
            })
            ->get();

        // FIXED: Calculate correct unit costs
        $transactionsWithCorrectCost = $this->correctUnitCosts($transactions, $fundCluster);

        // Monthly breakdown
        $monthlyBreakdown = collect();
        for ($month = 1; $month <= 12; $month++) {
            $monthStart = Carbon::createFromDate($year, $month, 1)->startOfMonth();
            $monthEnd = Carbon::createFromDate($year, $month, 1)->endOfMonth();

            $monthTransactions = $transactionsWithCorrectCost->whereBetween('transaction_date', [$monthStart, $monthEnd]);

            $monthlyBreakdown->push([
                'month' => $monthStart->format('M'),
                'month_full' => $monthStart->format('F'),
                'total' => $monthTransactions->sum('corrected_total_cost'),
                'items' => $monthTransactions->count(),
                'unique_items' => $monthTransactions->pluck('supply_id')->unique()->count(),
            ]);
        }

        // Quarterly data
        $quarterlyData = collect([
            [
                'quarter' => 'Q1',
                'months' => [1, 2, 3],
                'total' => $transactionsWithCorrectCost->filter(function ($item) {
                    return in_array(Carbon::parse($item->transaction_date)->month, [1, 2, 3]);
                })->sum('corrected_total_cost'),
            ],
            [
                'quarter' => 'Q2',
                'months' => [4, 5, 6],
                'total' => $transactionsWithCorrectCost->filter(function ($item) {
                    return in_array(Carbon::parse($item->transaction_date)->month, [4, 5, 6]);
                })->sum('corrected_total_cost'),
            ],
            [
                'quarter' => 'Q3',
                'months' => [7, 8, 9],
                'total' => $transactionsWithCorrectCost->filter(function ($item) {
                    return in_array(Carbon::parse($item->transaction_date)->month, [7, 8, 9]);
                })->sum('corrected_total_cost'),
            ],
            [
                'quarter' => 'Q4',
                'months' => [10, 11, 12],
                'total' => $transactionsWithCorrectCost->filter(function ($item) {
                    return in_array(Carbon::parse($item->transaction_date)->month, [10, 11, 12]);
                })->sum('corrected_total_cost'),
            ],
        ]);

        // Semester split (1st: Jan-Jun, 2nd: Jul-Dec), from the same corrected
        // transactions as the quarters above.
        $semesterData = collect([
            ['semester' => '1st semester', 'short' => 'S1', 'months' => [1, 2, 3, 4, 5, 6]],
            ['semester' => '2nd semester', 'short' => 'S2', 'months' => [7, 8, 9, 10, 11, 12]],
        ])->map(function ($semester) use ($transactionsWithCorrectCost) {
            $items = $transactionsWithCorrectCost->filter(function ($item) use ($semester) {
                return in_array(Carbon::parse($item->transaction_date)->month, $semester['months']);
            });

            return [
                'semester' => $semester['semester'],
                'short' => $semester['short'],
                'months' => $semester['months'],
                'total' => $items->sum('corrected_total_cost'),
                'items' => $items->count(),
                'unique_items' => $items->pluck('supply_id')->unique()->count(),
                'ris_count' => $items->pluck('reference_no')->unique()->count(),
            ];
        })->values();

        // Top categories (yearly)
        $topCategories = $transactionsWithCorrectCost->groupBy('supply.category.name')->map(function ($items, $category) {
            return [
                'category' => $category ?: 'Uncategorized',
                'total' => $items->sum('corrected_total_cost'),
                'items' => $items->count(),
                'unique_items' => $items->pluck('supply_id')->unique()->count(),
                'ris_count' => $items->pluck('reference_no')->unique()->count(),
            ];
        })->sortByDesc('total')->values();

        // Top items (yearly)
        $topItems = $transactionsWithCorrectCost->groupBy('supply_id')->map(function ($items) {
            $supply = $items->first()->supply;

            return [
                'item_name' => $supply->item_name,
                'stock_no' => $supply->stock_no,
                'total' => $items->sum('corrected_total_cost'),
                'quantity' => $items->sum('quantity'),
            ];
        })->sortByDesc('total')->take(15)->values();

        // Calculate insights
        $peakMonth = $monthlyBreakdown->sortByDesc('total')->first();
        $strongestQuarter = $quarterlyData->sortByDesc('total')->first();
        $mostExpensiveItem = $topItems->first();
        $mostUsedCategory = $topCategories->first();

        // Get last year data for growth calculation
        $lastYearTransactions = SupplyTransaction::where('transaction_type', 'issue')
            ->whereYear('transaction_date', $year - 1)
            ->whereHas('supply.stocks', function ($q) use ($fundCluster) {
                $q->where('fund_cluster', $fundCluster);
            })
            ->get();

        $lastYearWithCorrectCost = $this->correctUnitCosts($lastYearTransactions, $fundCluster);
        $lastYearTotal = $lastYearWithCorrectCost->sum('corrected_total_cost');

        $currentYearTotal = $transactionsWithCorrectCost->sum('corrected_total_cost');
        $growthRate = $lastYearTotal > 0 ? (($currentYearTotal - $lastYearTotal) / $lastYearTotal) * 100 : 0;

        // Summary statistics
        $summary = [
            'total_value' => $currentYearTotal,
            'total_items' => $transactionsWithCorrectCost->count(),
            'unique_items' => $transactionsWithCorrectCost->pluck('supply_id')->unique()->count(),
            'total_ris' => $transactionsWithCorrectCost->pluck('reference_no')->unique()->count(),
            'avg_monthly' => $currentYearTotal / 12,
            'peak_month' => $peakMonth['month_full'] ?? 'N/A',
        ];

        $insights = [
            'busiest_month' => $monthlyBreakdown->sortByDesc('items')->first()['month_full'] ?? 'N/A',
            'most_expensive_item' => $mostExpensiveItem['item_name'] ?? 'N/A',
            'most_used_category' => $mostUsedCategory['category'] ?? 'N/A',
            'growth_rate' => $growthRate,
            'strongest_quarter' => $strongestQuarter['quarter'] ?? 'N/A',
            'strongest_quarter_value' => $strongestQuarter['total'] ?? 0,
        ];

        return [
            'summary' => $summary,
            'monthly_breakdown' => $monthlyBreakdown,
            'quarterly_data' => $quarterlyData,
            'semester_data' => $semesterData,
            'top_categories' => $topCategories,
            'top_items' => $topItems,
            'insights' => $insights,
        ];
    }
}
