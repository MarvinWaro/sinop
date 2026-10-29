import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, FileText } from 'lucide-react';
import { ChartCard } from '@/components/chart-card';
import { BarChart } from '@/components/charts';
import { PageContainer, PageHeader } from '@/components/page-header';
import { TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    formatCompactPeso,
    formatMoney,
    monthNames,
    shortMonthNames,
    toNumber,
} from '@/lib/format';
import { generate, index as rsmiIndex, monthlyComparison } from '@/routes/rsmi';

type Props = {
    monthlyData: { month: string; total: number | string }[];
    year: number;
    fundCluster: string;
};

export default function RsmiMonthlyComparison({
    monthlyData,
    year,
    fundCluster,
}: Props) {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];

    for (let y = currentYear; y >= 2024; y--) {
        years.push(y);
    }

    if (!years.includes(year)) {
        years.push(year);
    }

    const yearTotal = monthlyData.reduce(
        (sum, m) => sum + toNumber(m.total),
        0,
    );

    const visit = (params: {
        year?: string | number;
        fund_cluster?: string;
    }) => {
        router.get(
            monthlyComparison.url(),
            {
                year: params.year ?? year,
                fund_cluster: params.fund_cluster ?? fundCluster,
            },
            { preserveScroll: true },
        );
    };

    const monthKey = (name: string) => {
        const index = monthNames.indexOf(name);

        return `${year}-${String(index + 1).padStart(2, '0')}`;
    };

    return (
        <>
            <Head title={`Monthly comparison ${year}`} />
            <PageContainer>
                <PageHeader
                    title={`Monthly comparison – ${year}`}
                    description={`Supplies issued per month · Fund cluster ${fundCluster}`}
                    actions={
                        <>
                            <NativeSelect
                                value={String(year)}
                                onChange={(e) =>
                                    visit({ year: e.target.value })
                                }
                                className="w-28"
                                aria-label="Year"
                            >
                                {years.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </NativeSelect>
                            <NativeSelect
                                value={fundCluster}
                                onChange={(e) =>
                                    visit({ fund_cluster: e.target.value })
                                }
                                className="w-44"
                                aria-label="Fund cluster"
                            >
                                <option value="101">Fund cluster 101</option>
                                <option value="151">Fund cluster 151</option>
                            </NativeSelect>
                            <Button asChild variant="outline">
                                <Link href={rsmiIndex()}>
                                    <ArrowLeft />
                                    Back to RSMI
                                </Link>
                            </Button>
                        </>
                    }
                />

                <ChartCard
                    title={`Monthly issuance trend – ${year}`}
                    description="Total amount issued per month"
                >
                    <BarChart
                        labels={monthlyData.map(
                            (m) =>
                                shortMonthNames[monthNames.indexOf(m.month)] ??
                                m.month,
                        )}
                        series={[
                            {
                                name: 'Total amount issued',
                                values: monthlyData.map((m) =>
                                    toNumber(m.total),
                                ),
                            },
                        ]}
                        formatValue={formatCompactPeso}
                    />
                </ChartCard>

                <ChartCard title="Monthly totals">
                    <TablePanel flush>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">
                                        Total amount issued
                                    </TableHead>
                                    <TableHead className="w-32 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyData.map((m) => (
                                    <TableRow key={m.month}>
                                        <TableCell>{m.month}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            ₱{formatMoney(m.total, 4)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {toNumber(m.total) > 0 ? (
                                                <Button
                                                    asChild
                                                    variant="ghost"
                                                    size="sm"
                                                >
                                                    <Link
                                                        href={generate({
                                                            query: {
                                                                month: monthKey(
                                                                    m.month,
                                                                ),
                                                                fund_cluster:
                                                                    fundCluster,
                                                            },
                                                        })}
                                                    >
                                                        <FileText />
                                                        View report
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    No data
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell>Year total</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        ₱{formatMoney(yearTotal, 4)}
                                    </TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </TablePanel>
                </ChartCard>
            </PageContainer>
        </>
    );
}

RsmiMonthlyComparison.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'RSMI', href: rsmiIndex() },
        {
            title: `Monthly comparison – ${props.year}`,
            href: monthlyComparison({
                query: { year: props.year, fund_cluster: props.fundCluster },
            }),
        },
    ],
});
