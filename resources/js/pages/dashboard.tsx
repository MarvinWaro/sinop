import { Deferred, Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRightLeft,
    ArrowUpRight,
    Package,
    Users,
    Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { YearlyIssuanceAnalytics } from '@/components/analytics/yearly-issuance-analytics';
import type { YearlyData } from '@/components/analytics/yearly-issuance-analytics';
import { StockXrayBox } from '@/components/analytics/stock-xray-box';
import {
    BarChart,
    DonutChart,
    DonutLegend,
    LineChart,
    chartColors,
} from '@/components/charts';
import type { ChartSeries } from '@/components/charts';
import { EmptyState } from '@/components/empty-state';
import { FormSelect } from '@/components/form-select';
import { PageContainer, PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCan } from '@/hooks/use-can';
import { formatNumber, formatPeso, monthNames } from '@/lib/format';
import { dashboard } from '@/routes';
import { yearlyAnalytics } from '@/routes/rsmi';
import { index as suppliesIndex } from '@/routes/supplies';
import { index as transactionsIndex } from '@/routes/supply-transactions';
import { index as usersIndex } from '@/routes/users';

type TypeKey = 'receipt' | 'issue' | 'adjustment';

/** [type][year][month] = count */
type MonthlyData = Partial<
    Record<TypeKey, Record<string, Record<string, number>>>
>;
/** [type][department][year][month] = count */
type DepartmentData = Partial<
    Record<TypeKey, Record<string, Record<string, Record<string, number>>>>
>;

type Props = {
    stats: {
        employeeCount: number;
        totalSupplies: number;
        totalStockValue: number;
        lowStockItems: number;
        transactionsThisMonth: number;
        transactionPercentChange: number;
        totalUsers: number;
        totalProperties: number;
        totalLocations: number;
        lastUpdated: string | null;
        lastTransactionUpdate: string | null;
    };
    monthlyTransactions: MonthlyData;
    departmentTransactions: DepartmentData;
    stockStatusData: {
        wellStocked: number;
        lowStock: number;
        outOfStock: number;
    };
    analyticsYear: number;
    analyticsFundCluster: string;
    /** Deferred: arrives in a second request after the page has painted. */
    yearlyAnalytics?: YearlyData;
};

const typeLabels: Record<TypeKey, string> = {
    receipt: 'Receipt (IN)',
    issue: 'Issue (OUT)',
    adjustment: 'Adjustment',
};

const typeColors: Record<TypeKey, string> = {
    receipt: chartColors[1],
    issue: chartColors[0],
    adjustment: chartColors[3],
};

const shortMonths = monthNames.map((month) => month.slice(0, 3));

export default function Dashboard(props: Props) {
    const can = useCan();
    const { auth } = usePage().props;
    const firstName = auth.user?.name.split(' ')[0];

    return (
        <>
            <Head title="Dashboard" />
            <PageContainer>
                <PageHeader
                    title={
                        firstName ? `Welcome back, ${firstName}` : 'Dashboard'
                    }
                    description="Supplies, transactions and issuance at a glance"
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="Employees"
                        value={formatNumber(props.stats.employeeCount)}
                        icon={Users}
                        href={can('users.view') ? usersIndex() : undefined}
                        description={
                            props.stats.lastUpdated
                                ? `Updated ${props.stats.lastUpdated}`
                                : undefined
                        }
                    />
                    <StatCard
                        title="Total supplies"
                        value={formatNumber(props.stats.totalSupplies)}
                        icon={Package}
                        href={suppliesIndex()}
                        description={
                            props.stats.lowStockItems > 0
                                ? `${props.stats.lowStockItems} at or below reorder point`
                                : 'All items above reorder point'
                        }
                    />
                    <StatCard
                        title="Stock value"
                        value={formatPeso(props.stats.totalStockValue)}
                        icon={Wallet}
                        href={suppliesIndex()}
                        description="Available stock on hand"
                    />
                    <StatCard
                        title="Transactions this month"
                        value={formatNumber(props.stats.transactionsThisMonth)}
                        icon={ArrowRightLeft}
                        href={transactionsIndex()}
                        description={
                            props.stats.lastTransactionUpdate
                                ? `Updated ${props.stats.lastTransactionUpdate}`
                                : undefined
                        }
                    />
                </div>

                <TransactionsOverview data={props.monthlyTransactions} />

                <div className="grid gap-4 lg:grid-cols-12">
                    <DivisionDistribution data={props.departmentTransactions} />
                    <StockOverview data={props.stockStatusData} />
                </div>

                <IssuanceAnalytics
                    year={props.analyticsYear}
                    fundCluster={props.analyticsFundCluster}
                    data={props.yearlyAnalytics}
                />
            </PageContainer>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};

/* -------------------------------------------------------------------------- */
/* Issuance analytics (RSMI yearly + semester)                                 */
/* -------------------------------------------------------------------------- */

function IssuanceAnalytics({
    year,
    fundCluster,
    data,
}: {
    year: number;
    fundCluster: string;
    data?: YearlyData;
}) {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
    const yearOptions = years.includes(year) ? years : [year, ...years];

    const reload = (params: {
        year?: string | number;
        fund_cluster?: string;
    }) => {
        router.reload({
            data: {
                analytics_year: params.year ?? year,
                fund_cluster: params.fund_cluster ?? fundCluster,
            },
            only: ['yearlyAnalytics', 'analyticsYear', 'analyticsFundCluster'],
        });
    };

    return (
        <section
            aria-labelledby="issuance-analytics"
            className="space-y-4 border-t pt-6"
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                    <h2
                        id="issuance-analytics"
                        className="text-lg font-semibold tracking-tight"
                    >
                        Issuance analytics · {year}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Supplies issued through posted RIS, fund cluster{' '}
                        {fundCluster}. Same figures as RSMI yearly analytics.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <FormSelect
                        value={String(year)}
                        onValueChange={(value) => reload({ year: value })}
                        className="w-28"
                        aria-label="Analytics year"
                        options={yearOptions.map((y) => ({
                            value: y,
                            label: String(y),
                        }))}
                    />
                    <FormSelect
                        value={fundCluster}
                        onValueChange={(value) =>
                            reload({ fund_cluster: value })
                        }
                        className="w-44"
                        aria-label="Analytics fund cluster"
                        options={[
                            { value: '101', label: 'Fund cluster 101' },
                            { value: '151', label: 'Fund cluster 151' },
                        ]}
                    />
                    <Button asChild variant="outline">
                        <Link
                            href={yearlyAnalytics({
                                query: { year, fund_cluster: fundCluster },
                            })}
                        >
                            Full RSMI analytics
                            <ArrowUpRight />
                        </Link>
                    </Button>
                </div>
            </div>

            <Deferred data="yearlyAnalytics" fallback={<AnalyticsSkeleton />}>
                {data ? (
                    <YearlyIssuanceAnalytics data={data} />
                ) : (
                    <AnalyticsSkeleton />
                )}
            </Deferred>
        </section>
    );
}

function AnalyticsSkeleton() {
    return (
        <div
            className="space-y-6"
            aria-busy="true"
            aria-label="Loading analytics"
        >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-48 rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Transactions overview                                                       */
/* -------------------------------------------------------------------------- */

function yearsIn(data: MonthlyData): string[] {
    const years = new Set<string>();

    Object.values(data).forEach((byYear) => {
        Object.keys(byYear ?? {}).forEach((year) => years.add(year));
    });

    return [...years].sort((a, b) => Number(b) - Number(a));
}

function TransactionsOverview({ data }: { data: MonthlyData }) {
    const years = useMemo(() => yearsIn(data), [data]);
    const [year, setYear] = useState<string>(years[0] ?? 'all');
    const [type, setType] = useState<'all' | TypeKey>('all');
    const [chartType, setChartType] = useState<'line' | 'bar'>('line');

    const types: TypeKey[] =
        type === 'all' ? ['receipt', 'issue', 'adjustment'] : [type];

    const series: ChartSeries[] = types.map((key) => ({
        name: typeLabels[key],
        color: typeColors[key],
        values: Array.from({ length: 12 }, (_, index) => {
            const byYear = data[key] ?? {};
            const selectedYears = year === 'all' ? Object.keys(byYear) : [year];

            return selectedYears.reduce(
                (sum, y) => sum + Number(byYear[y]?.[String(index + 1)] ?? 0),
                0,
            );
        }),
    }));

    const monthlyTotals = Array.from({ length: 12 }, (_, index) =>
        series.reduce((sum, s) => sum + (s.values[index] ?? 0), 0),
    );
    const total = monthlyTotals.reduce((sum, value) => sum + value, 0);
    const activeMonths = monthlyTotals.filter((value) => value > 0).length;
    const highestIndex = monthlyTotals.indexOf(Math.max(...monthlyTotals));

    const Chart = chartType === 'line' ? LineChart : BarChart;

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                    <CardTitle>Transactions overview</CardTitle>
                    <CardDescription>
                        Monthly transaction trends by transaction date
                    </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <FormSelect
                        value={year}
                        onValueChange={(value) => setYear(value)}
                        className="w-32"
                        aria-label="Year"
                        options={[
                            { value: 'all', label: 'All years' },
                            ...years.map((y) => ({ value: y, label: y })),
                        ]}
                    />
                    <FormSelect
                        value={type}
                        onValueChange={(value) =>
                            setType(value as 'all' | TypeKey)
                        }
                        className="w-40"
                        aria-label="Transaction type"
                        options={[
                            { value: 'all', label: 'All types' },
                            { value: 'receipt', label: 'Receipt (IN)' },
                            { value: 'issue', label: 'Issue (OUT)' },
                            { value: 'adjustment', label: 'Adjustment' },
                        ]}
                    />
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={chartType}
                        onValueChange={(value: string) =>
                            value && setChartType(value as 'line' | 'bar')
                        }
                    >
                        <ToggleGroupItem value="line" className="px-3">
                            Line
                        </ToggleGroupItem>
                        <ToggleGroupItem value="bar" className="px-3">
                            Bar
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Chart labels={shortMonths} series={series} />
                <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
                    <Metric
                        label="Total transactions"
                        value={formatNumber(total)}
                    />
                    <Metric
                        label="Average per month"
                        value={formatNumber(
                            activeMonths > 0 ? total / activeMonths : 0,
                        )}
                    />
                    <Metric
                        label="Highest month"
                        value={
                            total > 0
                                ? `${monthNames[highestIndex]} (${formatNumber(monthlyTotals[highestIndex])})`
                                : '—'
                        }
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Division distribution + stock overview                                      */
/* -------------------------------------------------------------------------- */

function DivisionDistribution({ data }: { data: DepartmentData }) {
    const years = useMemo(() => {
        const set = new Set<string>();

        Object.values(data).forEach((byDept) =>
            Object.values(byDept ?? {}).forEach((byYear) =>
                Object.keys(byYear).forEach((y) => set.add(y)),
            ),
        );

        return [...set].sort((a, b) => Number(b) - Number(a));
    }, [data]);

    const [type, setType] = useState<'all' | TypeKey>('issue');
    const [month, setMonth] = useState('all');
    const [year, setYear] = useState('all');

    const totals = new Map<string, number>();
    const types: TypeKey[] =
        type === 'all' ? ['receipt', 'issue', 'adjustment'] : [type];

    types.forEach((key) => {
        Object.entries(data[key] ?? {}).forEach(([department, byYear]) => {
            Object.entries(byYear).forEach(([y, byMonth]) => {
                if (year !== 'all' && y !== year) {
                    return;
                }

                Object.entries(byMonth).forEach(([m, count]) => {
                    if (month !== 'all' && m !== month) {
                        return;
                    }

                    totals.set(
                        department,
                        (totals.get(department) ?? 0) + Number(count),
                    );
                });
            });
        });
    });

    const slices = [...totals.entries()]
        .map(([label, value]) => ({ label, value }))
        .filter((slice) => slice.value > 0)
        .sort((a, b) => b.value - a.value);

    const top = slices.slice(0, 7);
    const others = slices.slice(7).reduce((sum, slice) => sum + slice.value, 0);
    const chartData =
        others > 0 ? [...top, { label: 'Others', value: others }] : top;

    return (
        <Card className="lg:col-span-6">
            <CardHeader className="space-y-3">
                <div className="space-y-1.5">
                    <CardTitle>Division distribution</CardTitle>
                    <CardDescription>
                        Transactions by division. Those without a division
                        aren't counted.
                    </CardDescription>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <FormSelect
                        value={type}
                        onValueChange={(value) =>
                            setType(value as 'all' | TypeKey)
                        }
                        className="w-full"
                        aria-label="Type"
                        options={[
                            { value: 'all', label: 'All types' },
                            { value: 'receipt', label: 'In (Receipt)' },
                            { value: 'issue', label: 'Out (Issue)' },
                            { value: 'adjustment', label: 'Adjustment' },
                        ]}
                    />
                    <FormSelect
                        value={month}
                        onValueChange={(value) => setMonth(value)}
                        className="w-full"
                        aria-label="Month"
                        options={[
                            { value: 'all', label: 'All months' },
                            ...monthNames.map((name, index) => ({
                                value: String(index + 1),
                                label: name,
                            })),
                        ]}
                    />
                    <FormSelect
                        value={year}
                        onValueChange={(value) => setYear(value)}
                        className="w-full"
                        aria-label="Year"
                        options={[
                            { value: 'all', label: 'All years' },
                            ...years.map((y) => ({ value: y, label: y })),
                        ]}
                    />
                </div>
            </CardHeader>
            <CardContent>
                {chartData.length === 0 ? (
                    <EmptyState
                        title="No division data available"
                        description="Try a different type, month or year."
                    />
                ) : (
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-6">
                            <Metric
                                label="Active divisions"
                                value={formatNumber(slices.length)}
                            />
                            <Metric
                                label="Most active"
                                value={slices[0]?.label ?? '—'}
                            />
                        </div>
                        <DonutChart
                            data={chartData}
                            size={170}
                            orientation="horizontal"
                            centerLabel="Transactions"
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StockOverview({ data }: { data: Props['stockStatusData'] }) {
    const slices = [
        {
            label: 'Well stocked',
            value: data.wellStocked,
            color: 'oklch(0.6 0.13 150)',
        },
        { label: 'Low stock', value: data.lowStock, color: chartColors[3] },
        {
            label: 'Out of stock',
            value: data.outOfStock,
            color: chartColors[0],
        },
    ];
    const [active, setActive] = useState<number | null>(null);
    // Without WebGL (or if Three.js can't load), the donut shows instead.
    const [boxUnavailable, setBoxUnavailable] = useState(false);

    return (
        <Card className="lg:col-span-6">
            <CardHeader>
                <CardTitle>Stock overview</CardTitle>
                <CardDescription>Current inventory status</CardDescription>
            </CardHeader>
            <CardContent>
                {boxUnavailable ? (
                    <DonutChart centerLabel="Supplies" data={slices} />
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <StockXrayBox
                            slices={slices}
                            active={active}
                            onUnavailable={() => setBoxUnavailable(true)}
                        />
                        <p className="text-sm text-muted-foreground">
                            <span className="text-lg font-semibold text-foreground tabular-nums">
                                {formatNumber(
                                    data.wellStocked +
                                        data.lowStock +
                                        data.outOfStock,
                                )}
                            </span>{' '}
                            supplies
                        </p>
                        <DonutLegend data={slices} onActive={setActive} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
