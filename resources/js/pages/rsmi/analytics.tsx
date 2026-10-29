import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Building2,
    FileText,
    Package,
    Receipt,
    Wallet,
} from 'lucide-react';
import { ChartCard } from '@/components/chart-card';
import { BarList, DonutChart, ScatterChart } from '@/components/charts';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    formatCompactPeso,
    formatNumber,
    formatPeso,
    fundClusterLabel,
    toNumber,
    truncate,
} from '@/lib/format';
import { analytics, detailed, index as rsmiIndex } from '@/routes/rsmi';

type Amount = number | string;

export type DetailedAnalytics = {
    categories: {
        category: string;
        total_cost: Amount;
        item_count: number;
        unique_items: number;
    }[];
    top_expensive_items: {
        item_name: string;
        stock_no: string;
        total_cost: Amount;
        quantity: number;
    }[];
    supply_efficiency: {
        item_name: string;
        stock_no: string;
        total_cost: Amount;
        total_quantity: number;
        transaction_frequency: number;
        avg_cost_per_transaction: Amount;
        cost_per_unit: Amount;
        efficiency_score: Amount;
    }[];
    departments: {
        department: string;
        total_cost: Amount;
        item_count: number;
        unique_items: number;
    }[];
    ris_summary: {
        ris_no: string;
        total_cost: Amount;
        item_count: number;
        date: string;
    }[];
    unit_cost_analysis: {
        item_name: string;
        avg_cost: Amount;
        max_cost: Amount;
        min_cost: Amount;
        cost_variance: Amount;
        total_quantity: number;
    }[];
    summary_stats: {
        total_value: Amount;
        total_transactions: number;
        unique_items: number;
        unique_departments: number;
        unique_ris: number;
        avg_transaction_value: Amount;
        highest_single_transaction: Amount;
        date_range: { start: string; end: string };
    };
};

type Props = {
    month: string;
    monthLabel: string;
    entityName: string;
    fundCluster: string | null;
    departmentId: number | string | null;
    analyticsData: DetailedAnalytics;
};

const clusterOptions: { value: string | null; label: string }[] = [
    { value: null, label: 'All fund clusters' },
    { value: '101', label: 'Fund cluster 101' },
    { value: '151', label: 'Fund cluster 151' },
];

export default function RsmiAnalytics({
    month,
    monthLabel,
    fundCluster,
    departmentId,
    analyticsData: data,
}: Props) {
    const stats = data.summary_stats;
    const topCategory = data.categories[0];

    const queryFor = (cluster: string | null) => {
        const query: Record<string, string | number> = { month };

        if (cluster) {
            query.fund_cluster = cluster;
        }

        if (departmentId) {
            query.department_id = departmentId;
        }

        return query;
    };

    return (
        <>
            <Head title={`RSMI analytics ${monthLabel}`} />
            <PageContainer>
                <PageHeader
                    title={`RSMI analytics – ${monthLabel}`}
                    description={fundClusterLabel(fundCluster)}
                    actions={
                        <>
                            <Button asChild variant="outline">
                                <Link
                                    href={detailed({
                                        query: queryFor(fundCluster),
                                    })}
                                >
                                    <ArrowLeft />
                                    Back to report
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href={rsmiIndex()}>Back to RSMI</Link>
                            </Button>
                        </>
                    }
                />

                <Card className="py-4">
                    <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-medium">Fund cluster</p>
                            <p className="text-sm text-muted-foreground">
                                Select a fund cluster to view its analytics
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {clusterOptions.map((option) => (
                                <Button
                                    key={option.label}
                                    asChild
                                    size="sm"
                                    variant={
                                        (fundCluster ?? null) === option.value
                                            ? 'default'
                                            : 'outline'
                                    }
                                >
                                    <Link
                                        href={analytics({
                                            query: queryFor(option.value),
                                        })}
                                        preserveScroll
                                    >
                                        {option.label}
                                    </Link>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total value"
                        value={formatPeso(stats.total_value)}
                        description="Total issued amount"
                        icon={Wallet}
                    />
                    <StatCard
                        title="Items issued"
                        value={formatNumber(stats.unique_items)}
                        description="Unique supplies issued"
                        icon={Package}
                    />
                    <StatCard
                        title="Divisions"
                        value={formatNumber(stats.unique_departments)}
                        description="Divisions served"
                        icon={Building2}
                    />
                    <StatCard
                        title="Transactions"
                        value={formatNumber(stats.total_transactions)}
                        description="Total transactions"
                        icon={Receipt}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <ChartCard
                        title="Distribution by category"
                        description="Total cost breakdown by supply category"
                    >
                        {data.categories.length === 0 ? (
                            <NoData />
                        ) : (
                            <DonutChart
                                data={data.categories.map((c) => ({
                                    label: c.category,
                                    value: toNumber(c.total_cost),
                                }))}
                                formatValue={(v) => formatPeso(v)}
                                centerLabel="Total cost"
                            />
                        )}
                    </ChartCard>

                    <ChartCard
                        title="Supply efficiency analysis"
                        description="Transaction frequency vs average cost per transaction (bubble size = total cost)"
                    >
                        {data.supply_efficiency.length === 0 ? (
                            <NoData />
                        ) : (
                            <ScatterChart
                                points={data.supply_efficiency.map((item) => ({
                                    x: item.transaction_frequency,
                                    y: toNumber(item.avg_cost_per_transaction),
                                    size: toNumber(item.total_cost),
                                    label: item.item_name,
                                    detail: [
                                        `Stock no: ${item.stock_no}`,
                                        `Frequency: ${item.transaction_frequency} transactions`,
                                        `Avg cost/transaction: ${formatPeso(item.avg_cost_per_transaction)}`,
                                        `Total cost: ${formatPeso(item.total_cost)}`,
                                        `Efficiency score: ${toNumber(item.efficiency_score).toFixed(2)}`,
                                    ].join('\n'),
                                }))}
                                xLabel="Transaction frequency"
                                yLabel="Avg cost per transaction"
                                formatY={formatCompactPeso}
                            />
                        )}
                    </ChartCard>

                    <ChartCard
                        title="Top 10 most expensive items"
                        description="Items with the highest total cost"
                    >
                        {data.top_expensive_items.length === 0 ? (
                            <NoData />
                        ) : (
                            <BarList
                                data={data.top_expensive_items.map((item) => ({
                                    label: item.item_name,
                                    value: toNumber(item.total_cost),
                                    hint: `${formatNumber(item.quantity)} qty`,
                                }))}
                                formatValue={(v) => formatPeso(v)}
                            />
                        )}
                    </ChartCard>

                    <ChartCard
                        title="Division distribution"
                        description="Cost distribution across divisions"
                    >
                        {data.departments.length === 0 ? (
                            <NoData />
                        ) : (
                            <BarList
                                data={data.departments.map((d) => ({
                                    label: d.department,
                                    value: toNumber(d.total_cost),
                                    hint: `${formatNumber(d.item_count)} items`,
                                }))}
                                formatValue={(v) => formatPeso(v)}
                            />
                        )}
                    </ChartCard>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <ChartCard
                        title="Top RIS by value"
                        description="Highest value requisitions"
                    >
                        {data.ris_summary.length === 0 ? (
                            <NoData />
                        ) : (
                            <TablePanel flush>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>RIS no.</TableHead>
                                            <TableHead className="text-right">
                                                Value
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Items
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.ris_summary.map((ris) => (
                                            <TableRow key={ris.ris_no}>
                                                <TableCell className="font-medium">
                                                    {ris.ris_no}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {formatPeso(ris.total_cost)}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {ris.item_count}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TablePanel>
                        )}
                    </ChartCard>

                    <ChartCard
                        title="Unit cost variance"
                        description="Items whose unit cost changed within the month"
                    >
                        {data.unit_cost_analysis.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">
                                No cost variations found
                            </p>
                        ) : (
                            <div className="grid gap-3">
                                {data.unit_cost_analysis.map((item, index) => (
                                    <div
                                        key={`${item.item_name}-${index}`}
                                        className="rounded-md border p-3 text-sm"
                                    >
                                        <p
                                            className="truncate font-medium"
                                            title={item.item_name}
                                        >
                                            {truncate(item.item_name, 35)}
                                        </p>
                                        <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
                                            <span>
                                                Min: {formatPeso(item.min_cost)}
                                            </span>
                                            <span>
                                                Max: {formatPeso(item.max_cost)}
                                            </span>
                                            <span className="font-medium text-foreground">
                                                Variance:{' '}
                                                {formatPeso(item.cost_variance)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ChartCard>

                    <ChartCard
                        title="Quick insights"
                        description="Key metrics at a glance"
                    >
                        <dl className="grid gap-3 text-sm">
                            <Insight
                                label="Avg transaction value"
                                value={formatPeso(stats.avg_transaction_value)}
                            />
                            <Insight
                                label="Highest single transaction"
                                value={formatPeso(
                                    stats.highest_single_transaction,
                                )}
                            />
                            <Insight
                                label="Total categories"
                                value={formatNumber(data.categories.length)}
                            />
                            <Insight
                                label="Report period"
                                value={`${stats.date_range.start} – ${stats.date_range.end}`}
                            />
                            {topCategory && (
                                <Insight
                                    label="Top category"
                                    value={
                                        <span className="flex flex-col items-end">
                                            <span>{topCategory.category}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatPeso(
                                                    topCategory.total_cost,
                                                )}
                                            </span>
                                        </span>
                                    }
                                />
                            )}
                        </dl>
                    </ChartCard>
                </div>
            </PageContainer>
        </>
    );
}

function NoData() {
    return (
        <EmptyState
            icon={FileText}
            title="No data for this period"
            className="py-8"
        />
    );
}

function Insight({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
        </div>
    );
}

RsmiAnalytics.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'RSMI', href: rsmiIndex() },
        {
            title: `Analytics – ${props.monthLabel}`,
            href: analytics({ query: { month: props.month } }),
        },
    ],
});
