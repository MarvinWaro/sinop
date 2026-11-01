<?php

namespace App\Http\Controllers;

use App\Enums\ActivityAction;
use App\Enums\ActivityModule;
use App\Models\Location;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\Supply;
use App\Models\SupplyStock;
use App\Models\SupplyTransaction;
use App\Models\User;
use App\Services\ActivityRecorder;
use App\Services\RsmiAnalyticsService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function dashboard(Request $request)
    {
        // FIXED: Employee count (including staff, admin, and cao)
        $employeeCount = User::whereIn('role', ['staff', 'admin', 'cao'])->count();

        // Total supplies count
        $totalSupplies = Supply::count();

        // Total stock value - Using the stored total_cost value from the database
        $totalStockValue = SupplyStock::where('status', 'available')
            ->sum('total_cost');

        // Low stock items - Using raw DB query that doesn't rely on relationship
        $lowStockItems = DB::table('supplies')
            ->leftJoin(DB::raw('(SELECT supply_id, SUM(quantity_on_hand) as total_qty FROM supply_stocks WHERE status = "available" GROUP BY supply_id) as ss'),
                'supplies.supply_id', '=', 'ss.supply_id')
            ->whereRaw('COALESCE(ss.total_qty, 0) <= supplies.reorder_point')
            ->count();

        // UPDATED: Count transactions this month using transaction_date (business date) for consistency
        $currentMonth = Carbon::now()->month;
        $currentYear = Carbon::now()->year;

        $transactionsThisMonth = SupplyTransaction::whereMonth('transaction_date', $currentMonth)
            ->whereYear('transaction_date', $currentYear)
            ->count();

        // Get percentage change from last month (also using transaction_date)
        $lastMonth = Carbon::now()->subMonth();
        $transactionsLastMonth = SupplyTransaction::whereMonth('transaction_date', $lastMonth->month)
            ->whereYear('transaction_date', $lastMonth->year)
            ->count();

        $transactionPercentChange = $transactionsLastMonth > 0
            ? round((($transactionsThisMonth - $transactionsLastMonth) / $transactionsLastMonth) * 100, 1)
            : 0;

        // Get the latest transaction created/updated time (based on database record change)
        $latestTransactionUpdate = SupplyTransaction::latest('created_at')->first();
        $lastTransactionUpdateTime = $latestTransactionUpdate ? $latestTransactionUpdate->created_at : null;

        // Stats for the page (keep existing ones)
        $totalUsers = User::count();
        $lastUpdatedRecord = User::latest('updated_at')->first();
        $lastUpdated = $lastUpdatedRecord ? $lastUpdatedRecord->updated_at : null;
        // Removed properties/locations stay in the table flagged `excluded`
        // (they are recycled on the next create), so only count active rows.
        $totalProperties = Property::where('excluded', 0)->count();
        $totalLocations = Location::where('excluded', 0)->count();

        // NEW: Get monthly transactions data for chart
        $monthlyTransactions = $this->getMonthlyTransactionsData();

        // NEW: Get department distribution data for donut chart
        $departmentTransactions = $this->getDepartmentTransactionsData();

        // NEW: Get stock status data for donut chart
        $stockStatusData = $this->getStockStatusData();

        // Yearly issuance analytics (same figures as RSMI > Yearly analytics).
        // Deferred so the dashboard paints first and the analytics follow.
        $analyticsYear = (int) $request->integer('analytics_year', Carbon::now()->year);
        $analyticsFundCluster = in_array($request->get('fund_cluster'), ['101', '151'], true)
            ? $request->get('fund_cluster')
            : '101';

        return Inertia::render('dashboard', [
            'analyticsYear' => $analyticsYear,
            'analyticsFundCluster' => $analyticsFundCluster,
            'yearlyAnalytics' => Inertia::defer(
                fn () => app(RsmiAnalyticsService::class)->yearly($analyticsYear, $analyticsFundCluster),
            ),
            'stats' => [
                'employeeCount' => $employeeCount,
                'totalSupplies' => $totalSupplies,
                'totalStockValue' => (float) $totalStockValue,
                'lowStockItems' => $lowStockItems,
                'transactionsThisMonth' => $transactionsThisMonth,
                'transactionPercentChange' => $transactionPercentChange,
                'totalUsers' => $totalUsers,
                'totalProperties' => $totalProperties,
                'totalLocations' => $totalLocations,
                'lastUpdated' => $lastUpdated?->diffForHumans(),
                'lastTransactionUpdate' => $lastTransactionUpdateTime?->diffForHumans(),
            ],
            'monthlyTransactions' => (object) $monthlyTransactions,
            'departmentTransactions' => (object) $departmentTransactions,
            'stockStatusData' => $stockStatusData,
        ]);
    }

    /**
     * NEW: Get monthly transactions data for the chart with transaction type breakdown
     * Uses transaction_date (business date) and groups by transaction type
     */
    private function getMonthlyTransactionsData()
    {
        try {
            // Get transactions data for the last 3 years grouped by transaction type
            $transactions = SupplyTransaction::select(
                'transaction_type',
                DB::raw('YEAR(transaction_date) as year'),
                DB::raw('MONTH(transaction_date) as month'),
                DB::raw('COUNT(*) as total')
            )
                ->where('transaction_date', '>=', Carbon::now()->subYears(3))
                ->groupBy('transaction_type', 'year', 'month')
                ->orderBy('transaction_type', 'asc')
                ->orderBy('year', 'asc')
                ->orderBy('month', 'asc')
                ->get();

            // Format data for Chart.js: [transaction_type][year][month] = count
            $monthlyData = [];
            foreach ($transactions as $transaction) {
                $monthlyData[$transaction->transaction_type][$transaction->year][$transaction->month] = $transaction->total;
            }

            return $monthlyData;

        } catch (\Exception $e) {
            // Log the error and return empty array if something goes wrong
            \Log::error('Error fetching monthly transactions data: '.$e->getMessage());

            return [];
        }
    }

    /**
     * NEW: Get department transactions data for donut chart
     * Only includes transactions with a real department_id
     */
    private function getDepartmentTransactionsData()
    {
        try {
            $transactions = SupplyTransaction::with('department')
                ->whereNotNull('department_id')
                ->select(
                    'department_id',
                    'transaction_type',
                    DB::raw('YEAR(transaction_date) as year'),
                    DB::raw('MONTH(transaction_date) as month'),
                    DB::raw('COUNT(*) as total')
                )
                ->where('transaction_date', '>=', Carbon::now()->subYears(3))
                ->groupBy('department_id', 'transaction_type', 'year', 'month')
                ->orderBy('year', 'asc')
                ->orderBy('month', 'asc')
                ->get();

            $departmentData = [];

            foreach ($transactions as $t) {
                // skip if no relation
                if (! $t->department) {
                    continue;
                }

                $type = $t->transaction_type;
                $dept = $t->department->name;
                $departmentData[$type][$dept][$t->year][$t->month] = $t->total;
            }

            return $departmentData;

        } catch (\Exception $e) {
            Log::error('Error fetching department transactions data: '.$e->getMessage());

            return [];
        }
    }

    /**
     * NEW: Get stock status data for donut chart
     * Categorizes supplies based on current stock levels vs reorder points
     */
    private function getStockStatusData()
    {
        try {
            // Get supplies with their current stock levels
            $supplies = DB::table('supplies')
                ->leftJoin(DB::raw('(SELECT supply_id, SUM(quantity_on_hand) as total_qty FROM supply_stocks WHERE status = "available" GROUP BY supply_id) as ss'),
                    'supplies.supply_id', '=', 'ss.supply_id')
                ->select(
                    'supplies.supply_id',
                    'supplies.item_name',
                    'supplies.reorder_point',
                    DB::raw('COALESCE(ss.total_qty, 0) as current_stock')
                )
                ->get();

            $wellStocked = 0;
            $lowStock = 0;
            $outOfStock = 0;

            foreach ($supplies as $supply) {
                $currentStock = (int) $supply->current_stock;
                $reorderPoint = (int) $supply->reorder_point;

                if ($currentStock == 0) {
                    $outOfStock++;
                } elseif ($currentStock <= $reorderPoint) {
                    $lowStock++;
                } else {
                    $wellStocked++;
                }
            }

            return [
                'wellStocked' => $wellStocked,
                'lowStock' => $lowStock,
                'outOfStock' => $outOfStock,
            ];

        } catch (\Exception $e) {
            \Log::error('Error fetching stock status data: '.$e->getMessage());

            return [
                'wellStocked' => 0,
                'lowStock' => 0,
                'outOfStock' => 0,
            ];
        }
    }

    private function getMonthlyTransactionsDataWithRIS()
    {
        try {
            // Get SupplyTransaction data using transaction_date
            $supplyTransactions = SupplyTransaction::select(
                DB::raw('YEAR(transaction_date) as year'),
                DB::raw('MONTH(transaction_date) as month'),
                DB::raw('COUNT(*) as total')
            )
                ->where('transaction_date', '>=', Carbon::now()->subYears(3))
                ->groupBy('year', 'month')
                ->get();

            // Get RIS data (if you want to include RIS slips in the count)
            // Adjust the date field based on your RIS table structure
            $risTransactions = RisSlip::select(
                DB::raw('YEAR(created_at) as year'), // Adjust this field if RIS has a different date field
                DB::raw('MONTH(created_at) as month'),
                DB::raw('COUNT(*) as total')
            )
                ->where('created_at', '>=', Carbon::now()->subYears(3))
                ->groupBy('year', 'month')
                ->get();

            // Combine both transaction types
            $allTransactions = $supplyTransactions->concat($risTransactions);

            // Aggregate the combined data
            $monthlyData = [];
            foreach ($allTransactions as $transaction) {
                if (! isset($monthlyData[$transaction->year])) {
                    $monthlyData[$transaction->year] = [];
                }
                if (! isset($monthlyData[$transaction->year][$transaction->month])) {
                    $monthlyData[$transaction->year][$transaction->month] = 0;
                }
                $monthlyData[$transaction->year][$transaction->month] += $transaction->total;
            }

            return $monthlyData;

        } catch (\Exception $e) {
            \Log::error('Error fetching monthly transactions data with RIS: '.$e->getMessage());

            return [];
        }
    }

    /**
     * OPTIONAL: Get additional analytics data for future use
     * Updated to use transaction_date for consistency
     */
    private function getTransactionAnalytics()
    {
        try {
            $analytics = [
                'total_supply_transactions' => SupplyTransaction::count(),
                'total_ris_slips' => RisSlip::count(),
                'transactions_this_year' => SupplyTransaction::whereYear('transaction_date', Carbon::now()->year)->count(),
                'average_monthly_transactions' => round(SupplyTransaction::count() / max(1, SupplyTransaction::selectRaw('COUNT(DISTINCT YEAR(transaction_date), MONTH(transaction_date)) as months')->value('months'))),
                'most_active_month' => SupplyTransaction::selectRaw('MONTH(transaction_date) as month, COUNT(*) as total')
                    ->groupBy('month')
                    ->orderBy('total', 'desc')
                    ->first(),
            ];

            return $analytics;
        } catch (\Exception $e) {
            \Log::error('Error fetching transaction analytics: '.$e->getMessage());

            return [];
        }
    }

    /**
     * DEBUG: Temporary method to check what data is being returned
     * Updated for transaction type breakdown and donut chart data
     */
    public function debugChartData()
    {
        $data = $this->getMonthlyTransactionsData();
        $deptData = $this->getDepartmentTransactionsData();
        $stockData = $this->getStockStatusData();

        // Also get raw query results for debugging
        $rawData = SupplyTransaction::select(
            'transaction_type',
            DB::raw('YEAR(transaction_date) as year'),
            DB::raw('MONTH(transaction_date) as month'),
            DB::raw('COUNT(*) as total'),
            DB::raw('MIN(transaction_date) as first_date'),
            DB::raw('MAX(transaction_date) as last_date')
        )
            ->where('transaction_date', '>=', Carbon::now()->subYears(3))
            ->groupBy('transaction_type', 'year', 'month')
            ->orderBy('transaction_type', 'asc')
            ->orderBy('year', 'asc')
            ->orderBy('month', 'asc')
            ->get();

        // Get transaction type counts
        $typeCounts = SupplyTransaction::select('transaction_type', DB::raw('COUNT(*) as total'))
            ->groupBy('transaction_type')
            ->get();

        // Get department counts
        $deptCounts = SupplyTransaction::with('department')
            ->select('department_id', DB::raw('COUNT(*) as total'))
            ->groupBy('department_id')
            ->get()
            ->map(function ($item) {
                return [
                    'department' => $item->department ? $item->department->name : 'Unknown',
                    'total' => $item->total,
                ];
            });

        return response()->json([
            'line_chart_data' => $data,
            'department_donut_data' => $deptData,
            'stock_status_data' => $stockData,
            'raw_transactions_data' => $rawData,
            'transaction_type_counts' => $typeCounts,
            'department_counts' => $deptCounts,
            'total_transactions' => SupplyTransaction::count(),
            'total_supplies' => Supply::count(),
            'date_range' => [
                'from' => Carbon::now()->subYears(3)->format('Y-m-d'),
                'to' => Carbon::now()->format('Y-m-d'),
            ],
        ]);
    }

    public function assets()
    {
        $activeProperties = Property::where('properties.excluded', 0);

        $totalProperties = (clone $activeProperties)->count();
        $totalLocations = Location::where('excluded', 0)->count();
        // People accountable for at least one property.
        $totalHolders = (clone $activeProperties)->whereNotNull('user_id')->distinct()->count('user_id');

        // Real breakdowns replace the hardcoded demo charts of the Blade page.
        $byCondition = (clone $activeProperties)
            ->selectRaw("COALESCE(NULLIF(`condition`, ''), 'Unspecified') as label, COUNT(*) as total")
            ->groupBy('label')
            ->orderByDesc('total')
            ->get();

        $byFund = (clone $activeProperties)
            ->selectRaw("COALESCE(NULLIF(fund, ''), 'Unspecified') as label, COUNT(*) as total")
            ->groupBy('label')
            ->orderByDesc('total')
            ->get();

        $byLocation = (clone $activeProperties)
            ->join('locations', 'locations.id', '=', 'properties.location_id')
            ->selectRaw('locations.location_name as label, COUNT(*) as total')
            ->groupBy('locations.location_name')
            ->orderByDesc('total')
            ->limit(6)
            ->get();

        $recentProperties = (clone $activeProperties)
            ->with(['user:id,name,profile_photo_path', 'location:id,location_name', 'images:id,property_id,file_path'])
            ->latest('updated_at')
            ->limit(8)
            ->get(['id', 'property_number', 'item_name', 'condition', 'user_id', 'location_id', 'updated_at'])
            ->map(fn (Property $property) => [
                'id' => $property->id,
                'property_number' => $property->property_number,
                'item_name' => $property->item_name,
                'condition' => $property->condition,
                'holder' => $property->user?->name,
                'holder_avatar' => $property->user?->avatar,
                'location' => $property->location?->location_name,
                'image_url' => $property->images->first()?->url,
                'updated_at' => $property->updated_at,
            ]);

        return Inertia::render('assets/dashboard', [
            'totalProperties' => $totalProperties,
            'totalLocations' => $totalLocations,
            'totalHolders' => $totalHolders,
            'byCondition' => $byCondition,
            'byFund' => $byFund,
            'byLocation' => $byLocation,
            'recentProperties' => $recentProperties,
        ]);
    }

    /**
     * Switch admin/cao to user mode for requesting supplies
     */
    public function switchToUserMode(Request $request)
    {
        // Store in session that admin is in user mode
        session(['admin_user_mode' => true]);
        session(['original_role' => Auth::user()->role]);
        app(ActivityRecorder::class)->record(ActivityAction::SwitchedMode, ActivityModule::System, label: 'Switched to user mode');

        return redirect()->route('admin.user-dashboard')->with('success', 'Switched to User Mode. You can now request supplies.');
    }

    /**
     * Switch back to admin mode
     */
    public function switchToAdminMode(Request $request)
    {
        // Remove user mode session
        session()->forget(['admin_user_mode', 'original_role']);
        app(ActivityRecorder::class)->record(ActivityAction::SwitchedMode, ActivityModule::System, label: 'Switched back to admin mode');

        return redirect()->route('dashboard')->with('success', 'Switched back to Admin Mode.');
    }
}
