import { Head, Link } from '@inertiajs/react';
import { Eye, History } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { visitWithQuery } from '@/components/search-form';
import { TransactionTypeBadge } from '@/components/status-badges';
import { TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
    formatDate,
    formatMoney,
    formatNumber,
    formatTime,
} from '@/lib/format';
import { index as transactionsIndex } from '@/routes/supply-transactions';
import type { Paginated, SupplyTransaction } from '@/types';

type Props = {
    txns: Paginated<SupplyTransaction>;
    filters: { from?: string; to?: string; type?: string };
};

const rowTone: Record<string, string> = {
    receipt: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    issue: 'bg-red-50/40 dark:bg-red-950/20',
    adjustment: 'bg-amber-50/40 dark:bg-amber-950/20',
};

export default function TransactionsIndex({ txns, filters }: Props) {
    const [from, setFrom] = useState(filters.from ?? '');
    const [to, setTo] = useState(filters.to ?? '');
    const [type, setType] = useState(filters.type ?? '');
    const [viewing, setViewing] = useState<SupplyTransaction | null>(null);

    const apply = (event: FormEvent) => {
        event.preventDefault();
        visitWithQuery(transactionsIndex.url(), { from, to, type });
    };

    const hasFilters = Boolean(filters.from || filters.to || filters.type);

    return (
        <>
            <Head title="Supply transactions" />
            <PageContainer>
                <PageHeader
                    title="Supply transactions"
                    description="All inventory movements: receipts, issues and adjustments"
                />

                <div className="space-y-4">
                    <form
                        onSubmit={apply}
                        className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="from">From date</Label>
                            <Input
                                id="from"
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="to">To date</Label>
                            <Input
                                id="to"
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">Transaction type</Label>
                            <NativeSelect
                                id="type"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                            >
                                <option value="">All types</option>
                                <option value="receipt">Receipt (IN)</option>
                                <option value="issue">Issue (OUT)</option>
                                <option value="adjustment">Adjustment</option>
                            </NativeSelect>
                        </div>
                        <div className="flex gap-2 lg:col-span-2">
                            <Button type="submit">Apply filters</Button>
                            {hasFilters && (
                                <Button asChild variant="ghost">
                                    <Link href={transactionsIndex()}>
                                        Clear filters
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </form>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Types:</span>
                        <TransactionTypeBadge type="receipt" />
                        <TransactionTypeBadge type="issue" />
                        <TransactionTypeBadge type="adjustment" />
                        <Badge variant="secondary" className="ml-auto">
                            {formatNumber(txns.total)} transactions
                        </Badge>
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Date &amp; time</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Stock no</TableHead>
                                    <TableHead>Item name</TableHead>
                                    <TableHead className="text-right">
                                        Qty
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Balance
                                    </TableHead>
                                    <TableHead>Ref no</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {txns.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9}>
                                            <EmptyState
                                                icon={History}
                                                title="No transactions found"
                                                description="Try a different date range or type."
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    txns.data.map((txn) => (
                                        <TableRow
                                            key={txn.transaction_id}
                                            className={cn(
                                                rowTone[txn.transaction_type],
                                            )}
                                        >
                                            <TableCell className="text-muted-foreground">
                                                {txn.transaction_id}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>
                                                        {formatDate(
                                                            txn.transaction_date,
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatTime(
                                                            txn.created_at,
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <TransactionTypeBadge
                                                    type={txn.transaction_type}
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {txn.supply?.stock_no}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {txn.supply?.item_name}
                                            </TableCell>
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {txn.transaction_type ===
                                                'receipt'
                                                    ? `+${formatNumber(txn.quantity)}`
                                                    : txn.transaction_type ===
                                                        'issue'
                                                      ? `-${formatNumber(txn.quantity)}`
                                                      : formatNumber(
                                                            txn.quantity,
                                                        )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatNumber(
                                                    txn.balance_quantity,
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {txn.reference_no}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        setViewing(txn)
                                                    }
                                                    aria-label="View transaction"
                                                >
                                                    <Eye />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>

                    <DataPagination paginator={txns} />
                </div>
            </PageContainer>

            <Dialog
                open={viewing !== null}
                onOpenChange={(open: boolean) => !open && setViewing(null)}
            >
                <DialogContent className="sm:max-w-2xl">
                    {viewing && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    Transaction #{viewing.transaction_id}
                                </DialogTitle>
                                <DialogDescription>
                                    {formatDate(viewing.transaction_date)} ·{' '}
                                    {formatTime(viewing.created_at)}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <DetailGroup title="Transaction">
                                    <Detail label="Type">
                                        <TransactionTypeBadge
                                            type={viewing.transaction_type}
                                        />
                                    </Detail>
                                    <Detail label="Reference no.">
                                        {viewing.reference_no}
                                    </Detail>
                                    <Detail label="Fund cluster">
                                        {viewing.fund_cluster ?? '—'}
                                    </Detail>
                                </DetailGroup>
                                <DetailGroup title="Supply">
                                    <Detail label="Item name">
                                        {viewing.supply?.item_name}
                                    </Detail>
                                    <Detail label="Stock no.">
                                        {viewing.supply?.stock_no}
                                    </Detail>
                                </DetailGroup>
                                <DetailGroup title="Quantity & cost">
                                    <Detail label="Quantity">
                                        {formatNumber(viewing.quantity)}
                                    </Detail>
                                    <Detail label="Unit cost">
                                        ₱{formatMoney(viewing.unit_cost, 4)}
                                    </Detail>
                                    <Detail label="Total cost">
                                        ₱{formatMoney(viewing.total_cost, 4)}
                                    </Detail>
                                    <Detail label="Balance after transaction">
                                        {formatNumber(viewing.balance_quantity)}
                                    </Detail>
                                </DetailGroup>
                                <DetailGroup title="Personnel">
                                    <Detail label="Department">
                                        {viewing.department?.name ?? '—'}
                                    </Detail>
                                    <Detail label="User / staff">
                                        {viewing.user?.name ?? '—'}
                                    </Detail>
                                </DetailGroup>
                            </div>
                            <div className="rounded-md border p-3 text-sm">
                                <p className="font-medium">Remarks</p>
                                <p className="text-muted-foreground">
                                    {viewing.remarks || 'No remarks'}
                                </p>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

TransactionsIndex.layout = {
    breadcrumbs: [{ title: 'Transactions', href: transactionsIndex() }],
};

function DetailGroup({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">{title}</p>
            <dl className="grid gap-2 text-sm">{children}</dl>
        </div>
    );
}

function Detail({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium">{children}</dd>
        </div>
    );
}
