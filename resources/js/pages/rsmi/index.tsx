import { Head, Link } from '@inertiajs/react';
import { BarChart3, FileText, Info, Layers, TrendingUp } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/page-header';
import { MonthClusterFilter } from '@/components/reports/month-cluster-filter';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    detailed,
    generate,
    index as rsmiIndex,
    monthlyComparison,
    yearlyAnalytics,
} from '@/routes/rsmi';

type Props = {
    availableMonths: string[];
    fundClusters: string[];
    selectedMonth: string;
    selectedDepartment: string | null;
    selectedFundCluster: string | null;
};

export default function RsmiIndex({
    availableMonths,
    fundClusters,
    selectedMonth,
    selectedFundCluster,
}: Props) {
    return (
        <>
            <Head title="RSMI" />
            <PageContainer>
                <PageHeader
                    title="Report of Supplies and Materials Issued (RSMI)"
                    description="Generate and view reports of supplies and materials issued for specific periods"
                    actions={
                        <Button asChild variant="outline">
                            <Link href={yearlyAnalytics()}>
                                <TrendingUp />
                                Yearly analytics
                            </Link>
                        </Button>
                    }
                />

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="size-4 text-muted-foreground" />
                                Monthly report
                            </CardTitle>
                            <CardDescription>
                                Supplies issued for a month, grouped by RIS,
                                with fund cluster details.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MonthClusterFilter
                                url={generate.url()}
                                months={availableMonths}
                                month={selectedMonth}
                                fundClusters={fundClusters}
                                fundCluster={selectedFundCluster}
                                submitLabel="Generate report"
                                submitVariant="default"
                                idPrefix="monthly"
                                stacked
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="size-4 text-muted-foreground" />
                                Detailed report by item
                            </CardTitle>
                            <CardDescription>
                                Issuances grouped by supply item with every RIS
                                that drew from it.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MonthClusterFilter
                                url={detailed.url()}
                                months={availableMonths}
                                month={availableMonths[0] ?? null}
                                fundClusters={fundClusters}
                                fundCluster={null}
                                submitLabel="View detailed report"
                                submitVariant="default"
                                idPrefix="detailed"
                                stacked
                            />
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="rounded-md border bg-muted/50 p-2 text-muted-foreground">
                                <BarChart3 className="size-4" />
                            </div>
                            <div>
                                <p className="font-medium">
                                    Monthly comparison
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Year-round comparison of supplies issued
                                    with trend analysis.
                                </p>
                            </div>
                        </div>
                        <Button asChild variant="outline">
                            <Link href={monthlyComparison()}>
                                View comparison chart
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Info className="size-4 text-muted-foreground" />
                            Tips for RSMI reports
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="ml-4 list-disc space-y-2 text-sm text-muted-foreground">
                            <li>
                                Generate monthly reports for official
                                documentation and record-keeping.
                            </li>
                            <li>
                                Use detailed reports to track specific item
                                movements across divisions.
                            </li>
                            <li>
                                Choose “All fund clusters” to combine 101 and
                                151, or pick one to separate budget allocations.
                            </li>
                            <li>
                                The comparison chart helps identify usage
                                patterns and plan future procurement.
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </PageContainer>
        </>
    );
}

RsmiIndex.layout = {
    breadcrumbs: [{ title: 'RSMI', href: rsmiIndex() }],
};
