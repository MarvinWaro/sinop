import {
    CalendarRange,
    FileText,
    Package,
    Receipt,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ChartCard } from '@/components/chart-card';
import {
    BarChart,
    BarList,
    DonutChart,
    LineChart,
    chartColors,
} from '@/components/charts';
import { EmptyState } from '@/components/empty-state';
import { StatCard } from '@/components/stat-card';
import { TablePanel } from '@/components/table-panel';
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
    toNumber,
    truncate,
} from '@/lib/format';
import { cn } from '@/lib/utils';

type Amount = number | string;

export type SemesterData = {
    semester: string;
    short: string;
    months: number[];
    total: Amount;
    items: number;
    unique_items: number;
    ris_count: number;
};

/** Shape returned by RsmiAnalyticsService::yearly(). */
export type YearlyData = {
    summary: {
        total_value: Amount;
        total_items: number;
        unique_items: number;
        total_ris: number;
        avg_monthly: Amount;
        peak_month: string;
    };
    monthly_breakdown: {
        month: string;
        month_full: string;
        total: Amount;
        items: number;
        unique_items: number;
    }[];
    quarterly_data: { quarter: string; months: number[]; total: Amount }[];
    semester_data: SemesterData[];
    top_categories: {
        category: string;
        total: Amount;
        items: number;
        unique_items: number;
        ris_count: number;
    }[];
    top_items: {
        item_name: string;
        stock_no: string;
        total: Amount;
        quantity: number;
    }[];
    insights: {
        busiest_month: string;
        most_expensive_item: string;
        most_used_category: string;
        growth_rate: Amount;
        strongest_quarter: string;
        strongest_quarter_value: Amount;
    };
};

/**
 * Yearly RSMI issuance analytics: KPIs, semester split, monthly and quarterly
 * trends, categories, top items and insights. Used on RSMI > Yearly analytics
 * and on the admin dashboard.
 */
export function YearlyIssuanceAnalytics({ data }: { data: YearlyData }) {
    const totalValue = toNumber(data.summary.total_value);
    const growth = toNumber(data.insights.growth_rate);

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard
                    title="Total value"
                    value={formatPeso(data.summary.total_value)}
                    description="Yearly total"
                    icon={Wallet}
                />
                <StatCard
                    title="Total items"
                    value={formatNumber(data.summary.total_items)}
                    description="Items processed"
                    icon={Package}
                />
                <StatCard
                    title="Total RIS"
                    value={formatNumber(data.summary.total_ris)}
                    description="Requisitions"
                    icon={Receipt}
                />
                <StatCard
                    title="Avg monthly"
                    value={formatPeso(data.summary.avg_monthly)}
                    description="Per month"
                    icon={TrendingUp}
                />
                <StatCard
                    title="Peak month"
                    value={data.summary.peak_month}
                    description="Highest activity"
                    icon={CalendarRange}
                />
            </div>

            <SemesterComparison
                semesters={data.semester_data}
                totalValue={totalValue}
            />

            <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard
                    title="Monthly spending trend"
                    description="Total cost per month throughout the year"
                >
                    <LineChart
                        labels={data.monthly_breakdown.map((m) => m.month)}
                        series={[
                            {
                                name: 'Total cost',
                                values: data.monthly_breakdown.map((m) =>
                                    toNumber(m.total),
                                ),
                            },
                        ]}
                        formatValue={formatCompactPeso}
                    />
                </ChartCard>

                <ChartCard
                    title="Quarterly comparison"
                    description="Spending compared by quarter"
                >
                    <BarChart
                        labels={data.quarterly_data.map((q) => q.quarter)}
                        series={[
                            {
                                name: 'Total cost',
                                values: data.quarterly_data.map((q) =>
                                    toNumber(q.total),
                                ),
                            },
                        ]}
                        formatValue={formatCompactPeso}
                    />
                </ChartCard>

                {/* Two stacked cards beside the tall Top 15 list, so the
                    column doesn't leave a gap under the donut. */}
                <div className="flex flex-col gap-6">
                    <ChartCard
                        title="Category distribution"
                        description="Total spending by category for the whole year"
                    >
                        {data.top_categories.length === 0 ? (
                            <NoData />
                        ) : (
                            <DonutChart
                                data={data.top_categories.map((c) => ({
                                    label: c.category,
                                    value: toNumber(c.total),
                                }))}
                                formatValue={(v) => formatPeso(v)}
                                centerLabel="Total cost"
                                orientation="horizontal"
                                size={176}
                            />
                        )}
                    </ChartCard>

                    <ChartCard
                        title="Monthly issuance volume"
                        description="Line items and distinct supplies issued each month"
                        className="flex-1"
                    >
                        <BarChart
                            labels={data.monthly_breakdown.map((m) => m.month)}
                            series={[
                                {
                                    name: 'Line items',
                                    values: data.monthly_breakdown.map(
                                        (m) => m.items,
                                    ),
                                },
                                {
                                    name: 'Distinct supplies',
                                    values: data.monthly_breakdown.map(
                                        (m) => m.unique_items,
                                    ),
                                },
                            ]}
                            height={240}
                        />
                    </ChartCard>
                </div>

                <ChartCard
                    title="Top 15 items"
                    description="Most expensive items across the whole year"
                >
                    {data.top_items.length === 0 ? (
                        <NoData />
                    ) : (
                        <BarList
                            data={data.top_items.map((item) => ({
                                label: item.item_name,
                                value: toNumber(item.total),
                                hint: `${formatNumber(item.quantity)} qty`,
                            }))}
                            formatValue={(v) => formatPeso(v)}
                        />
                    )}
                </ChartCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <ChartCard
                    title="Monthly breakdown"
                    description="Detailed monthly statistics"
                >
                    <TablePanel flush>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">
                                        Total
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Items
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.monthly_breakdown.map((m) => (
                                    <TableRow key={m.month}>
                                        <TableCell>{m.month}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatPeso(m.total)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {m.items}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TablePanel>
                </ChartCard>

                <ChartCard
                    title="Top categories"
                    description="Highest spending categories"
                >
                    {data.top_categories.length === 0 ? (
                        <NoData />
                    ) : (
                        <div className="grid gap-4">
                            {data.top_categories.map((category) => (
                                <div
                                    key={category.category}
                                    className="grid gap-1.5 text-sm"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="truncate font-medium">
                                            {category.category}
                                        </span>
                                        <span className="shrink-0 tabular-nums">
                                            {formatPeso(category.total)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Items: {category.items}</span>
                                        <span>RIS: {category.ris_count}</span>
                                    </div>
                                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-primary"
                                            style={{
                                                width: `${totalValue > 0 ? (toNumber(category.total) / totalValue) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ChartCard>

                <ChartCard
                    title="Yearly insights"
                    description="Key trends and patterns"
                >
                    <dl className="grid gap-3 text-sm">
                        <Insight
                            label="Busiest month"
                            value={data.insights.busiest_month}
                        />
                        <Insight
                            label="Most expensive item"
                            value={
                                <span title={data.insights.most_expensive_item}>
                                    {truncate(
                                        data.insights.most_expensive_item,
                                        20,
                                    )}
                                </span>
                            }
                        />
                        <Insight
                            label="Most used category"
                            value={data.insights.most_used_category}
                        />
                        <Insight
                            label="Growth vs last year"
                            value={
                                <span
                                    className={cn(
                                        growth > 0 &&
                                            'text-emerald-600 dark:text-emerald-400',
                                        growth < 0 && 'text-destructive',
                                    )}
                                >
                                    {growth >= 0 ? '+' : ''}
                                    {growth.toFixed(1)}%
                                </span>
                            }
                        />
                        <Insight
                            label="Strongest quarter"
                            value={
                                <span className="flex flex-col items-end">
                                    <span>
                                        {data.insights.strongest_quarter}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatPeso(
                                            data.insights
                                                .strongest_quarter_value,
                                        )}
                                    </span>
                                </span>
                            }
                        />
                    </dl>
                </ChartCard>
            </div>
        </div>
    );
}

const semesterColors = [chartColors[0], chartColors[1]];
const semesterRanges = ['Jan – Jun', 'Jul – Dec'];

/** 1st vs 2nd semester: values side by side with each one's share of the year. */
function SemesterComparison({
    semesters,
    totalValue,
}: {
    semesters: SemesterData[];
    totalValue: number;
}) {
    const [first, second] = semesters;

    if (!first || !second) {
        return null;
    }

    const firstValue = toNumber(first.total);
    const secondValue = toNumber(second.total);
    const share = (value: number) =>
        totalValue > 0 ? (value / totalValue) * 100 : 0;

    let verdict = 'No issuances recorded this year yet.';

    if (firstValue > 0 && secondValue > 0) {
        const leader = secondValue >= firstValue ? second : first;
        const change = ((secondValue - firstValue) / firstValue) * 100;
        verdict = `${leader.semester} led. The 2nd semester is ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% on the 1st.`;
    } else if (firstValue > 0 || secondValue > 0) {
        verdict = `All issuances so far fall in the ${firstValue > 0 ? first.semester : second.semester}.`;
    }

    return (
        <ChartCard title="Semester comparison" description={verdict}>
            <div className="space-y-5">
                <div
                    className="flex h-3 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                >
                    {[firstValue, secondValue].map((value, index) => (
                        <div
                            key={index}
                            className="h-full transition-[width]"
                            style={{
                                width: `${share(value)}%`,
                                background: semesterColors[index],
                            }}
                        />
                    ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    {[first, second].map((semester, index) => (
                        <div
                            key={semester.short}
                            className="rounded-lg border p-4"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="flex items-center gap-2 text-sm font-medium">
                                    <span
                                        className="size-2.5 rounded-full"
                                        style={{
                                            background: semesterColors[index],
                                        }}
                                    />
                                    {semester.semester}
                                    <span className="font-normal text-muted-foreground">
                                        {semesterRanges[index]}
                                    </span>
                                </p>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {share(toNumber(semester.total)).toFixed(1)}
                                    % of year
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-semibold tabular-nums">
                                {formatPeso(semester.total)}
                            </p>
                            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                                <SemesterFigure
                                    label="Items"
                                    value={formatNumber(semester.items)}
                                />
                                <SemesterFigure
                                    label="Unique items"
                                    value={formatNumber(semester.unique_items)}
                                />
                                <SemesterFigure
                                    label="RIS"
                                    value={formatNumber(semester.ris_count)}
                                />
                            </dl>
                        </div>
                    ))}
                </div>
            </div>
        </ChartCard>
    );
}

function SemesterFigure({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
        </div>
    );
}

function NoData() {
    return (
        <EmptyState
            icon={FileText}
            title="No data for this year"
            className="py-8"
        />
    );
}

function Insight({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
        </div>
    );
}
