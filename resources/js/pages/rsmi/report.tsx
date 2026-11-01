import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, FileSpreadsheet, PackageOpen } from 'lucide-react';
import { Fragment } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { MonthClusterFilter } from '@/components/reports/month-cluster-filter';
import { StatCard } from '@/components/stat-card';
import { TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { formatMoney, formatNumber, fundClusterLabel } from '@/lib/format';
import { exportExcel, generate, index as rsmiIndex } from '@/routes/rsmi';

type RsmiItem = {
    stock_no: string;
    item_name: string;
    description: string | null;
    unit: string;
    quantity_issued: number;
    unit_cost: number | string;
    total_cost: number | string;
};

type RsmiGroup = {
    ris_no: string;
    fund_cluster: string | null;
    department: string;
    issued_date: string;
    items: RsmiItem[];
};

type Props = {
    reportData: RsmiGroup[];
    summary: {
        total_items: number;
        total_cost: number | string;
        unique_supplies: number;
        departments_served: number;
        ris_count: number;
    };
    month: string;
    monthLabel: string;
    entityName: string;
    fundCluster: string | null;
    departmentId: number | string | null;
    availableMonths: string[];
    fundClusters: string[];
};

export default function RsmiReport(props: Props) {
    const can = useCan();
    const { reportData, summary, fundCluster } = props;
    const exportQuery = {
        month: props.month,
        fund_cluster: fundCluster ?? '',
        department_id: props.departmentId ?? '',
    };
    const columns = fundCluster ? 8 : 9;

    return (
        <>
            <Head title={`RSMI ${props.monthLabel}`} />
            <PageContainer>
                <PageHeader
                    title={`RSMI – ${props.monthLabel}`}
                    description={fundClusterLabel(fundCluster)}
                    actions={
                        <>
                            <Button asChild variant="outline">
                                <Link href={rsmiIndex()}>
                                    <ArrowLeft />
                                    Back to RSMI
                                </Link>
                            </Button>
                            {can('rsmi.export') && (
                                <Button asChild>
                                    <a
                                        href={exportExcel.url({
                                            query: exportQuery,
                                        })}
                                    >
                                        <FileSpreadsheet />
                                        Export Excel
                                    </a>
                                </Button>
                            )}
                        </>
                    }
                />

                <Card className="py-4">
                    <CardContent className="px-4">
                        <MonthClusterFilter
                            key={`${props.month}-${fundCluster ?? ''}`}
                            url={generate.url()}
                            months={props.availableMonths}
                            month={props.month}
                            fundClusters={props.fundClusters}
                            fundCluster={fundCluster}
                            autoApply
                        />
                    </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Total items issued"
                        value={formatNumber(summary.total_items)}
                    />
                    <StatCard
                        title="Total cost"
                        value={`₱${formatMoney(summary.total_cost, 4)}`}
                    />
                    <StatCard
                        title="Unique supplies"
                        value={formatNumber(summary.unique_supplies)}
                    />
                    <StatCard
                        title="RIS count"
                        value={formatNumber(summary.ris_count ?? 0)}
                    />
                </div>

                <Card>
                    <CardHeader className="text-center">
                        <CardTitle>
                            Report of Supplies and Materials Issued
                        </CardTitle>
                        <CardDescription>
                            {props.entityName}
                            <br />
                            {fundClusterLabel(fundCluster)} · {props.monthLabel}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TablePanel flush>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>RIS no.</TableHead>
                                        {!fundCluster && (
                                            <TableHead>Fund cluster</TableHead>
                                        )}
                                        <TableHead>
                                            Responsibility center code
                                        </TableHead>
                                        <TableHead>Stock no.</TableHead>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-right">
                                            Qty. issued
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Unit cost
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Amount
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportData.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={columns}>
                                                <EmptyState
                                                    icon={PackageOpen}
                                                    title="No supplies were issued for this period."
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        reportData.map((group) => (
                                            <Fragment key={group.ris_no}>
                                                {group.items.map(
                                                    (item, index) => (
                                                        <TableRow
                                                            key={`${group.ris_no}-${index}`}
                                                            className={
                                                                index === 0
                                                                    ? 'border-t-2'
                                                                    : undefined
                                                            }
                                                        >
                                                            <TableCell className="font-medium">
                                                                {index === 0
                                                                    ? group.ris_no
                                                                    : ''}
                                                            </TableCell>
                                                            {!fundCluster && (
                                                                <TableCell>
                                                                    {index ===
                                                                        0 && (
                                                                        <Badge variant="outline">
                                                                            {group.fund_cluster ??
                                                                                'N/A'}
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                            )}
                                                            <TableCell />
                                                            <TableCell className="font-mono">
                                                                {item.stock_no}
                                                            </TableCell>
                                                            <TableCell className="whitespace-normal">
                                                                {item.item_name}
                                                                {item.description
                                                                    ? `, ${item.description}`
                                                                    : ''}
                                                            </TableCell>
                                                            <TableCell>
                                                                {item.unit}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                {formatNumber(
                                                                    item.quantity_issued,
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                ₱
                                                                {formatMoney(
                                                                    item.unit_cost,
                                                                    4,
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
                                                                ₱
                                                                {formatMoney(
                                                                    item.total_cost,
                                                                    4,
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ),
                                                )}
                                            </Fragment>
                                        ))
                                    )}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns - 1}
                                            className="text-right"
                                        >
                                            Grand total
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            ₱
                                            {formatMoney(summary.total_cost, 4)}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </TablePanel>
                    </CardContent>
                </Card>
            </PageContainer>
        </>
    );
}

RsmiReport.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'RSMI', href: rsmiIndex() },
        {
            title: props.monthLabel,
            href: generate({
                query: {
                    month: props.month,
                    fund_cluster: props.fundCluster ?? '',
                },
            }),
        },
    ],
});
