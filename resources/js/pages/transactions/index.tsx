import { Head, Link } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronRight,
    Eye,
    History,
    ScrollText,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormSelect } from '@/components/form-select';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useCan } from '@/hooks/use-can';
import {
    formatDate,
    formatDateTime,
    formatMoney,
    formatNumber,
} from '@/lib/format';
import { risKey } from '@/lib/ris';
import { cn } from '@/lib/utils';
import { show as showRis } from '@/routes/ris';
import { show as showStockCard } from '@/routes/stock-cards';
import { index as transactionsIndex } from '@/routes/supply-transactions';
import type {
    Paginated,
    SupplyTransaction,
    SupplyTransactionDocument,
    TransactionLine,
} from '@/types';

type View = 'documents' | 'lines';

type Filters = {
    from: string | null;
    to: string | null;
    type: string | null;
    search: string | null;
    division: string | null;
    fund: string | null;
};

type Props = {
    view: View;
    filters: Filters;
    divisions: { id: number; name: string }[];
    fundClusters: string[];
    totals: { lines: number; documents?: number };
    /** Documents view. */
    documents?: Paginated<SupplyTransactionDocument>;
    /** Item lines view. */
    txns?: Paginated<SupplyTransaction>;
};

const rowTone: Record<string, string> = {
    receipt: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    issue: 'bg-red-50/40 dark:bg-red-950/20',
    adjustment: 'bg-amber-50/40 dark:bg-amber-950/20',
};

/** Receipts add (+), issues take away (−), adjustments as recorded. */
function signedQuantity(
    line: Pick<TransactionLine, 'transaction_type' | 'quantity'>,
): string {
    if (line.transaction_type === 'receipt') {
        return `+${formatNumber(line.quantity)}`;
    }

    if (line.transaction_type === 'issue') {
        return `−${formatNumber(line.quantity)}`;
    }

    return formatNumber(line.quantity);
}

function dateRange(from: string, to: string): string {
    return from === to
        ? formatDate(to)
        : `${formatDate(from)} – ${formatDate(to)}`;
}

export default function TransactionsIndex(props: Props) {
    const { view, filters } = props;
    const can = useCan();
    const [values, setValues] = useState({
        search: filters.search ?? '',
        from: filters.from ?? '',
        to: filters.to ?? '',
        type: filters.type ?? '',
        division: filters.division ?? '',
        fund: filters.fund ?? '',
    });
    const [viewing, setViewing] = useState<TransactionLine | null>(null);

    const visit = (next: Partial<typeof values> & { view?: View }) =>
        visitWithQuery(transactionsIndex.url(), {
            ...values,
            ...next,
            view: (next.view ?? view) === 'lines' ? 'lines' : undefined,
        });

    const apply = (event: FormEvent) => {
        event.preventDefault();
        visit({});
    };

    const set = (key: keyof typeof values, value: string) =>
        setValues((current) => ({ ...current, [key]: value }));

    const hasFilters = Object.values(filters).some(
        (value) => value !== null && value !== '',
    );
    const paginator = view === 'lines' ? props.txns : props.documents;

    return (
        <>
            <Head title="Supply transactions" />
            <PageContainer>
                <PageHeader
                    title="Supply transactions"
                    description="All inventory movements: receipts (IAR), issues (RIS) and adjustments"
                    actions={
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={view}
                            onValueChange={(value: string) =>
                                value && visit({ view: value as View })
                            }
                            aria-label="Show transactions as"
                        >
                            <ToggleGroupItem value="documents" className="px-3">
                                Documents
                            </ToggleGroupItem>
                            <ToggleGroupItem value="lines" className="px-3">
                                Item lines
                            </ToggleGroupItem>
                        </ToggleGroup>
                    }
                />

                <div className="space-y-4">
                    <form
                        onSubmit={apply}
                        className="flex flex-wrap items-end gap-3"
                        role="search"
                    >
                        <Field
                            label="Search"
                            htmlFor="search"
                            className="min-w-56 flex-1"
                        >
                            <Input
                                id="search"
                                value={values.search}
                                onChange={(e) => set('search', e.target.value)}
                                placeholder="Reference no, item or stock no"
                            />
                        </Field>
                        <Field
                            label="From date"
                            htmlFor="from"
                            className="w-40"
                        >
                            <Input
                                id="from"
                                type="date"
                                value={values.from}
                                onChange={(e) => set('from', e.target.value)}
                            />
                        </Field>
                        <Field label="To date" htmlFor="to" className="w-40">
                            <Input
                                id="to"
                                type="date"
                                value={values.to}
                                onChange={(e) => set('to', e.target.value)}
                            />
                        </Field>
                        <Field label="Type" htmlFor="type" className="w-36">
                            <FormSelect
                                id="type"
                                value={values.type}
                                onValueChange={(value) => set('type', value)}
                                options={[
                                    { value: '', label: 'All types' },
                                    { value: 'receipt', label: 'Receipt (IN)' },
                                    { value: 'issue', label: 'Issue (OUT)' },
                                    {
                                        value: 'adjustment',
                                        label: 'Adjustment',
                                    },
                                ]}
                            />
                        </Field>
                        <Field
                            label="Division"
                            htmlFor="division"
                            className="w-52"
                        >
                            <FormSelect
                                id="division"
                                value={values.division}
                                onValueChange={(value) =>
                                    set('division', value)
                                }
                                options={[
                                    { value: '', label: 'All divisions' },
                                    ...props.divisions.map((division) => ({
                                        value: division.id,
                                        label: division.name,
                                    })),
                                ]}
                            />
                        </Field>
                        <Field
                            label="Fund cluster"
                            htmlFor="fund"
                            className="w-32"
                        >
                            <FormSelect
                                id="fund"
                                value={values.fund}
                                onValueChange={(value) => set('fund', value)}
                                options={[
                                    { value: '', label: 'All funds' },
                                    ...props.fundClusters.map((fund) => ({
                                        value: fund,
                                        label: fund,
                                    })),
                                ]}
                            />
                        </Field>
                        <div className="flex gap-2">
                            <Button type="submit">Apply</Button>
                            {hasFilters && (
                                <Button asChild variant="ghost">
                                    <Link
                                        href={transactionsIndex({
                                            query:
                                                view === 'lines'
                                                    ? { view }
                                                    : {},
                                        })}
                                    >
                                        Clear
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
                        <Badge
                            variant="secondary"
                            className="ml-auto tabular-nums"
                        >
                            {props.totals.documents !== undefined &&
                                `${formatNumber(props.totals.documents)} documents · `}
                            {formatNumber(props.totals.lines)} item lines
                        </Badge>
                    </div>

                    {view === 'documents' && props.documents ? (
                        <DocumentsTable
                            documents={props.documents}
                            canOpenRis={can('ris.view')}
                            canOpenStockCard={can('stock-cards.view')}
                            onView={setViewing}
                        />
                    ) : (
                        props.txns && (
                            <LinesTable
                                txns={props.txns}
                                onView={setViewing}
                                onReference={(reference) =>
                                    visit({
                                        search: reference,
                                        view: 'documents',
                                    })
                                }
                            />
                        )
                    )}

                    {paginator && <DataPagination paginator={paginator} />}
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
                                    {formatDate(viewing.transaction_date)} ·
                                    Recorded on{' '}
                                    {formatDateTime(viewing.created_at)}
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
                                        {formatNumber(viewing.quantity)}{' '}
                                        {viewing.supply?.unit_of_measurement}
                                    </Detail>
                                    <Detail label="Unit cost">
                                        ₱{formatMoney(viewing.unit_cost, 4)}
                                    </Detail>
                                    <Detail label="Total cost">
                                        ₱{formatMoney(viewing.total_cost, 4)}
                                    </Detail>
                                    <Detail label="Balance after transaction">
                                        {formatNumber(viewing.balance_quantity)}{' '}
                                        {viewing.supply?.unit_of_measurement}
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

/* -------------------------------------------------------------------------- */
/* Documents: one row per IAR / RIS, expandable to its item lines              */
/* -------------------------------------------------------------------------- */

function DocumentsTable({
    documents,
    canOpenRis,
    canOpenStockCard,
    onView,
}: {
    documents: Paginated<SupplyTransactionDocument>;
    canOpenRis: boolean;
    canOpenStockCard: boolean;
    onView: (line: TransactionLine) => void;
}) {
    const [open, setOpen] = useState<Set<string>>(new Set());
    const allOpen =
        documents.data.length > 0 &&
        documents.data.every((doc) => open.has(doc.key));

    const toggle = (key: string) =>
        setOpen((current) => {
            const next = new Set(current);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }

            return next;
        });

    return (
        <div className="space-y-2">
            <div className="flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                        setOpen(
                            allOpen
                                ? new Set()
                                : new Set(documents.data.map((doc) => doc.key)),
                        )
                    }
                    disabled={documents.data.length === 0}
                >
                    {allOpen ? 'Collapse all' : 'Expand all'}
                </Button>
            </div>
            <TablePanel>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <span className="sr-only">Show items</span>
                            </TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Division</TableHead>
                            <TableHead>Fund</TableHead>
                            <TableHead className="text-right">Items</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead>Recorded by</TableHead>
                            <TableHead>Recorded on</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {documents.data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10}>
                                    <EmptyState
                                        icon={History}
                                        title="No transactions found"
                                        description="Try a different search, date range or filter."
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            documents.data.map((doc) => {
                                const expanded = open.has(doc.key);

                                return (
                                    <Fragment key={doc.key}>
                                        <TableRow
                                            className={cn(
                                                'cursor-pointer',
                                                rowTone[doc.transaction_type],
                                            )}
                                            onClick={() => toggle(doc.key)}
                                        >
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-7"
                                                    aria-expanded={expanded}
                                                    aria-label={`${expanded ? 'Hide' : 'Show'} items of ${doc.reference_no ?? 'this document'}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggle(doc.key);
                                                    }}
                                                >
                                                    {expanded ? (
                                                        <ChevronDown />
                                                    ) : (
                                                        <ChevronRight />
                                                    )}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {dateRange(
                                                    doc.date_from,
                                                    doc.date_to,
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <TransactionTypeBadge
                                                    type={doc.transaction_type}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {doc.ris_key && canOpenRis ? (
                                                    <Link
                                                        href={showRis(
                                                            risKey({
                                                                route_key:
                                                                    doc.ris_key,
                                                            }),
                                                        )}
                                                        className="text-primary hover:underline"
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                    >
                                                        {doc.reference_no}
                                                    </Link>
                                                ) : (
                                                    (doc.reference_no ??
                                                    'No reference')
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-56 truncate">
                                                {doc.multiple_divisions ? (
                                                    <span className="text-muted-foreground">
                                                        Multiple divisions
                                                    </span>
                                                ) : (
                                                    (doc.division ?? '—')
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {doc.fund_cluster ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatNumber(doc.item_count)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                ₱
                                                {formatMoney(
                                                    doc.total_value,
                                                    2,
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-40 truncate">
                                                {doc.recorded_by ?? '—'}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-muted-foreground">
                                                {formatDateTime(
                                                    doc.recorded_at,
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        {expanded && (
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell
                                                    colSpan={10}
                                                    className="bg-muted/30 p-3"
                                                >
                                                    <DocumentLines
                                                        doc={doc}
                                                        canOpenStockCard={
                                                            canOpenStockCard
                                                        }
                                                        onView={onView}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TablePanel>
        </div>
    );
}

function DocumentLines({
    doc,
    canOpenStockCard,
    onView,
}: {
    doc: SupplyTransactionDocument;
    canOpenStockCard: boolean;
    onView: (line: TransactionLine) => void;
}) {
    const spansDates = doc.date_from !== doc.date_to;

    return (
        <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">
                            Stock no
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                            Item
                        </th>
                        {spansDates && (
                            <th className="px-3 py-2 text-left font-medium">
                                Date
                            </th>
                        )}
                        <th className="px-3 py-2 text-right font-medium">
                            Qty
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                            Unit cost
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                            Value
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                            Balance after
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                            <span className="sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {doc.lines.map((line) => {
                        const unit = line.supply?.unit_of_measurement ?? '';

                        return (
                            <tr key={line.transaction_id}>
                                <td className="px-3 py-2 font-mono text-xs">
                                    {line.supply?.stock_no}
                                </td>
                                <td className="px-3 py-2 font-medium">
                                    {line.supply?.item_name}
                                </td>
                                {spansDates && (
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {formatDate(line.transaction_date)}
                                    </td>
                                )}
                                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                    {signedQuantity(line)}{' '}
                                    <span className="text-muted-foreground">
                                        {unit}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    ₱{formatMoney(line.unit_cost, 2)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    ₱{formatMoney(line.total_cost, 2)}
                                </td>
                                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                    {formatNumber(line.balance_quantity)}{' '}
                                    <span className="text-muted-foreground">
                                        {unit}
                                    </span>
                                </td>
                                <td className="px-3 py-1.5">
                                    <div className="flex justify-end gap-0.5">
                                        {canOpenStockCard && (
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="icon"
                                                className="size-7"
                                            >
                                                <Link
                                                    href={showStockCard(
                                                        line.supply_id,
                                                    )}
                                                    aria-label={`Stock card of ${line.supply?.item_name ?? 'this item'}`}
                                                    title="Stock card"
                                                >
                                                    <ScrollText />
                                                </Link>
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            onClick={() => onView(line)}
                                            aria-label="View transaction"
                                            title="Details"
                                        >
                                            <Eye />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Item lines: one row per line (the previous list)                            */
/* -------------------------------------------------------------------------- */

function LinesTable({
    txns,
    onView,
    onReference,
}: {
    txns: Paginated<SupplyTransaction>;
    onView: (line: TransactionLine) => void;
    onReference: (reference: string) => void;
}) {
    return (
        <TablePanel>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-16">ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Stock no</TableHead>
                        <TableHead>Item name</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Ref no</TableHead>
                        <TableHead>Recorded on</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {txns.data.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={10}>
                                <EmptyState
                                    icon={History}
                                    title="No transactions found"
                                    description="Try a different search, date range or filter."
                                />
                            </TableCell>
                        </TableRow>
                    ) : (
                        txns.data.map((txn) => {
                            const unit = txn.supply?.unit_of_measurement ?? '';

                            return (
                                <TableRow
                                    key={txn.transaction_id}
                                    className={cn(
                                        rowTone[txn.transaction_type],
                                    )}
                                >
                                    <TableCell className="text-muted-foreground">
                                        {txn.transaction_id}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {formatDate(txn.transaction_date)}
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
                                    <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                                        {signedQuantity(txn)}{' '}
                                        <span className="font-normal text-muted-foreground">
                                            {unit}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                                        {formatNumber(txn.balance_quantity)}{' '}
                                        <span className="text-muted-foreground">
                                            {unit}
                                        </span>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap">
                                        {txn.reference_no ? (
                                            <button
                                                type="button"
                                                className="text-primary hover:underline"
                                                onClick={() =>
                                                    onReference(
                                                        txn.reference_no,
                                                    )
                                                }
                                                title="Show the whole document"
                                            >
                                                {txn.reference_no}
                                            </button>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                        {formatDateTime(txn.created_at)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => onView(txn)}
                                            aria-label="View transaction"
                                        >
                                            <Eye />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </TablePanel>
    );
}

function Field({
    label,
    htmlFor,
    className,
    children,
}: {
    label: string;
    htmlFor: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
        </div>
    );
}

function DetailGroup({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">{title}</p>
            <dl className="grid gap-2 text-sm">{children}</dl>
        </div>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium">{children}</dd>
        </div>
    );
}
