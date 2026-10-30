import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, BarChart3, PackageOpen, Search } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { MonthClusterFilter } from '@/components/reports/month-cluster-filter';
import { SearchInput } from '@/components/search-input';
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
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    formatDate,
    formatMoney,
    formatNumber,
    fundClusterLabel,
} from '@/lib/format';
import { analytics, detailed, index as rsmiIndex } from '@/routes/rsmi';

type DetailedTransaction = {
    ris_no: string;
    fund_cluster: string | null;
    department: string;
    date: string;
    quantity: number;
    unit_cost: number | string;
    total: number | string;
};

type DetailedSupply = {
    supply_id: number;
    stock_no: string;
    item_name: string;
    description: string | null;
    unit: string;
    category: string;
    total_quantity: number;
    average_unit_cost: number | string;
    total_cost: number | string;
    transactions: DetailedTransaction[];
};

type Props = {
    reportData: DetailedSupply[];
    month: string;
    monthLabel: string;
    entityName: string;
    fundCluster: string | null;
    departmentId: number | string | null;
    availableMonths: string[];
    fundClusters: string[];
};

function matches(supply: DetailedSupply, term: string): boolean {
    const haystack = [
        supply.stock_no,
        supply.item_name,
        supply.category,
        ...supply.transactions.map((t) => t.ris_no),
        ...supply.transactions.map((t) => t.fund_cluster ?? ''),
    ]
        .join(' ')
        .toLowerCase();

    return haystack.includes(term);
}

export default function RsmiDetailed(props: Props) {
    const { reportData, fundCluster } = props;
    const [search, setSearch] = useState('');
    const term = search.trim().toLowerCase();
    const visible = term
        ? reportData.filter((supply) => matches(supply, term))
        : reportData;

    const analyticsQuery: Record<string, string | number> = {
        month: props.month,
    };

    if (fundCluster) {
        analyticsQuery.fund_cluster = fundCluster;
    }

    if (props.departmentId) {
        analyticsQuery.department_id = props.departmentId;
    }

    return (
        <>
            <Head title={`Detailed RSMI ${props.monthLabel}`} />
            <PageContainer>
                <PageHeader
                    title={`Detailed RSMI by item – ${props.monthLabel}`}
                    description={fundClusterLabel(fundCluster)}
                    actions={
                        <>
                            <Button asChild variant="outline">
                                <Link href={rsmiIndex()}>
                                    <ArrowLeft />
                                    Back to RSMI
                                </Link>
                            </Button>
                            <Button asChild>
                                <Link
                                    href={analytics({ query: analyticsQuery })}
                                >
                                    <BarChart3 />
                                    Analytics
                                </Link>
                            </Button>
                        </>
                    }
                />

                <Card className="py-4">
                    <CardContent className="space-y-4 px-4">
                        <MonthClusterFilter
                            key={`${props.month}-${fundCluster ?? ''}`}
                            url={detailed.url()}
                            months={props.availableMonths}
                            month={props.month}
                            fundClusters={props.fundClusters}
                            fundCluster={fundCluster}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <SearchInput
                                value={search}
                                onValueChange={setSearch}
                                placeholder="Search item, stock no., RIS no. or fund cluster..."
                                aria-label="Search items"
                                className="sm:w-96"
                            />
                            <p className="text-sm text-muted-foreground">
                                Showing {formatNumber(visible.length)} of{' '}
                                {formatNumber(reportData.length)} items
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {reportData.length === 0 ? (
                    <Card>
                        <CardContent>
                            <EmptyState
                                icon={PackageOpen}
                                title="No supplies were issued for this period."
                            />
                        </CardContent>
                    </Card>
                ) : visible.length === 0 ? (
                    <Card>
                        <CardContent>
                            <EmptyState
                                icon={Search}
                                title="No results found"
                                description="Try a different search, or clear it to show all items."
                                action={
                                    <Button
                                        variant="outline"
                                        onClick={() => setSearch('')}
                                    >
                                        Show all items
                                    </Button>
                                }
                            />
                        </CardContent>
                    </Card>
                ) : (
                    visible.map((supply) => (
                        <SupplyCard key={supply.supply_id} supply={supply} />
                    ))
                )}
            </PageContainer>
        </>
    );
}

function SupplyCard({ supply }: { supply: DetailedSupply }) {
    const clusters = [
        ...new Set(
            supply.transactions.map((t) => t.fund_cluster).filter(Boolean),
        ),
    ];

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    <CardTitle>{supply.item_name}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>Stock no. {supply.stock_no}</span>
                        <span>Category: {supply.category}</span>
                        {clusters.length > 0 && (
                            <span>
                                {clusters.length > 1
                                    ? 'Fund clusters'
                                    : 'Fund cluster'}
                                : {clusters.join(', ')}
                            </span>
                        )}
                    </CardDescription>
                </div>
                <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">
                        Total quantity issued
                    </p>
                    <p className="text-2xl font-semibold tabular-nums">
                        {formatNumber(supply.total_quantity)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {supply.unit}
                    </p>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <Metric
                        label="Average unit cost"
                        value={`₱${formatMoney(supply.average_unit_cost, 4)}`}
                    />
                    <Metric
                        label="Total cost"
                        value={`₱${formatMoney(supply.total_cost, 4)}`}
                    />
                    <Metric
                        label="Transactions"
                        value={formatNumber(supply.transactions.length)}
                    />
                </div>
                <TablePanel flush>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>RIS no.</TableHead>
                                <TableHead>Fund cluster</TableHead>
                                <TableHead>Division</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">
                                    Quantity
                                </TableHead>
                                <TableHead className="text-right">
                                    Unit cost
                                </TableHead>
                                <TableHead className="text-right">
                                    Total
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {supply.transactions.map((txn, index) => (
                                <TableRow key={`${txn.ris_no}-${index}`}>
                                    <TableCell className="font-medium">
                                        {txn.ris_no}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {txn.fund_cluster ?? 'N/A'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-56 truncate">
                                        {txn.department}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(txn.date)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatNumber(txn.quantity)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        ₱{formatMoney(txn.unit_cost, 4)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        ₱{formatMoney(txn.total, 4)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TablePanel>
            </CardContent>
        </Card>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-semibold tabular-nums">{value}</p>
        </div>
    );
}

RsmiDetailed.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'RSMI', href: rsmiIndex() },
        {
            title: `Detailed – ${props.monthLabel}`,
            href: detailed({
                query: {
                    month: props.month,
                    fund_cluster: props.fundCluster ?? '',
                },
            }),
        },
    ],
});
