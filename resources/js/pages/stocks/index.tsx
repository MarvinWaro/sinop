import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    BookOpen,
    Boxes,
    CircleCheck,
    CircleX,
    Layers,
    Pencil,
    Plus,
    ScrollText,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { IconAction, solidTones } from '@/components/icon-action';
import { PageContainer, PageHeader } from '@/components/page-header';
import { SearchForm } from '@/components/search-form';
import { SearchableSelect } from '@/components/searchable-select';
import { StockStatusBadge } from '@/components/status-badges';
import { TablePanel } from '@/components/table-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import {
    formatDate,
    formatMoney,
    formatNumber,
    toNumber,
    todayIso,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { getJson } from '@/lib/http';
import {
    show as showStockCard,
    index as stockCardsIndex,
} from '@/routes/stock-cards';
import {
    destroy,
    iarData,
    index as stocksIndex,
    nextIar,
    store,
    update,
} from '@/routes/stocks';
import {
    show as showLedgerCard,
    index as ledgerCardsIndex,
} from '@/routes/supply-ledger-cards';
import type {
    Department,
    Paginated,
    StockStatus,
    Supplier,
    Supply,
    SupplyStock,
} from '@/types';

type Props = {
    stocks: Paginated<SupplyStock>;
    supplies: Supply[];
    suppliers: Supplier[];
    departments: Department[];
    defaultIar: string;
    counts: {
        all: number;
        available: number;
        lowStock: number;
        depleted: number;
    };
    currentStatus: string | null;
    search: string | null;
};

const stockStatuses: StockStatus[] = [
    'available',
    'reserved',
    'expired',
    'depleted',
];

function submissionToken(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export default function StocksIndex(props: Props) {
    const can = useCan();
    const [creating, setCreating] = useState<{ prefill?: SupplyStock } | null>(
        null,
    );
    const [editing, setEditing] = useState<SupplyStock | null>(null);
    const [deleting, setDeleting] = useState<SupplyStock | null>(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);

    // Icon and count colours match the status badges in the table.
    const statusFilters: {
        value: string;
        label: string;
        count: number;
        icon: LucideIcon;
        iconClass: string;
        countClass: string;
    }[] = [
        {
            value: 'all',
            label: 'All',
            count: props.counts.all,
            icon: Layers,
            iconClass: 'text-muted-foreground',
            countClass: 'bg-muted text-muted-foreground',
        },
        {
            value: 'available',
            label: 'Available',
            count: props.counts.available,
            icon: CircleCheck,
            iconClass: 'text-emerald-500',
            countClass:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        },
        {
            value: 'low_stock',
            label: 'Low stock',
            count: props.counts.lowStock,
            icon: TriangleAlert,
            iconClass: 'text-amber-500',
            countClass:
                'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
        },
        {
            value: 'depleted',
            label: 'Depleted',
            count: props.counts.depleted,
            icon: CircleX,
            iconClass: 'text-red-500',
            countClass:
                'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
        },
    ];
    const current = props.currentStatus ?? 'all';

    const confirmDelete = () => {
        if (!deleting) {
            return;
        }

        router.delete(destroy.url(deleting.stock_id), {
            preserveScroll: true,
            onStart: () => setDeleteProcessing(true),
            onFinish: () => {
                setDeleteProcessing(false);
                setDeleting(null);
            },
        });
    };

    return (
        <>
            <Head title="Stocks" />
            <PageContainer>
                <PageHeader
                    title="Supply stocks"
                    description="Stock on hand per supply and fund cluster. Record deliveries with an IAR."
                    actions={
                        <>
                            {can('stock-cards.view') && (
                                <Button asChild className={solidTones.green}>
                                    <Link href={stockCardsIndex()}>
                                        <ScrollText />
                                        Stock cards
                                    </Link>
                                </Button>
                            )}
                            {can('ledger-cards.view') && (
                                <Button asChild className={solidTones.gray}>
                                    <Link href={ledgerCardsIndex()}>
                                        <BookOpen />
                                        Ledger cards
                                    </Link>
                                </Button>
                            )}
                            {can('stocks.create') && (
                                <Button
                                    className={solidTones.red}
                                    onClick={() => setCreating({})}
                                >
                                    <Plus />
                                    New IAR
                                </Button>
                            )}
                        </>
                    }
                />

                <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                            {statusFilters.map((filter) => {
                                const active = current === filter.value;

                                return (
                                    <Button
                                        key={filter.value}
                                        asChild
                                        size="sm"
                                        variant={active ? 'default' : 'outline'}
                                    >
                                        <Link
                                            href={stocksIndex()}
                                            data={{
                                                status: filter.value,
                                                ...(props.search
                                                    ? {
                                                          search: props.search,
                                                      }
                                                    : {}),
                                            }}
                                            preserveScroll
                                            aria-current={
                                                active ? 'page' : undefined
                                            }
                                        >
                                            <filter.icon
                                                className={
                                                    active
                                                        ? undefined
                                                        : filter.iconClass
                                                }
                                            />
                                            {filter.label}
                                            <span
                                                className={cn(
                                                    'rounded-full px-1.5 py-0.5 text-xs leading-none font-medium tabular-nums',
                                                    active
                                                        ? 'bg-primary-foreground/20 text-primary-foreground'
                                                        : filter.countClass,
                                                )}
                                            >
                                                {filter.count}
                                            </span>
                                        </Link>
                                    </Button>
                                );
                            })}
                        </div>
                        <SearchForm
                            url={stocksIndex.url()}
                            defaultValue={props.search}
                            params={{ status: props.currentStatus }}
                            placeholder="Search item name or stock no..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Stock no</TableHead>
                                    <TableHead>Supply item</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="text-right">
                                        Quantity
                                    </TableHead>
                                    <TableHead>Fund</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {props.stocks.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9}>
                                            <EmptyState
                                                icon={Boxes}
                                                title="No stocks found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    props.stocks.data.map((stock) => (
                                        <TableRow key={stock.stock_id}>
                                            <TableCell className="font-mono">
                                                {stock.supply?.stock_no}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                <p className="font-medium">
                                                    {stock.supply?.item_name}
                                                </p>
                                                {stock.supply?.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {
                                                            stock.supply
                                                                .description
                                                        }
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-40 truncate">
                                                {stock.supplier?.name ?? '—'}
                                            </TableCell>
                                            <TableCell className="max-w-48 truncate">
                                                {stock.department?.name ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatNumber(
                                                    stock.quantity_on_hand,
                                                )}{' '}
                                                {
                                                    stock.supply
                                                        ?.unit_of_measurement
                                                }
                                            </TableCell>
                                            <TableCell>
                                                {stock.fund_cluster ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <StockStatusBadge
                                                        stock={stock}
                                                    />
                                                    {stock.dynamic_status ===
                                                        'low_stock' && (
                                                        <span className="text-xs text-muted-foreground">
                                                            Need to reorder
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {stock.expiry_date
                                                    ? formatDate(
                                                          stock.expiry_date,
                                                      )
                                                    : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-0.5">
                                                    {can('stocks.create') && (
                                                        <IconAction
                                                            tone="red"
                                                            label={`Add stock to ${stock.supply?.item_name ?? 'this item'}`}
                                                            onClick={() =>
                                                                setCreating({
                                                                    prefill:
                                                                        stock,
                                                                })
                                                            }
                                                        >
                                                            <Plus />
                                                        </IconAction>
                                                    )}
                                                    {can('stocks.update') && (
                                                        <IconAction
                                                            tone="amber"
                                                            label="Re-value stock"
                                                            onClick={() =>
                                                                setEditing(
                                                                    stock,
                                                                )
                                                            }
                                                        >
                                                            <Pencil />
                                                        </IconAction>
                                                    )}
                                                    {can(
                                                        'stock-cards.view',
                                                    ) && (
                                                        <IconAction
                                                            tone="green"
                                                            label="View stock card"
                                                            href={showStockCard(
                                                                stock.supply_id,
                                                            )}
                                                        >
                                                            <ScrollText />
                                                        </IconAction>
                                                    )}
                                                    {can(
                                                        'ledger-cards.view',
                                                    ) && (
                                                        <IconAction
                                                            tone="gray"
                                                            label="View supply ledger card"
                                                            href={showLedgerCard(
                                                                stock.supply_id,
                                                            )}
                                                        >
                                                            <BookOpen />
                                                        </IconAction>
                                                    )}
                                                    {can('stocks.delete') && (
                                                        <IconAction
                                                            tone="red"
                                                            label="Delete stock"
                                                            onClick={() =>
                                                                setDeleting(
                                                                    stock,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 />
                                                        </IconAction>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>

                    <DataPagination paginator={props.stocks} />
                </div>
            </PageContainer>

            {(can('stocks.create') ||
                can('stocks.update') ||
                can('stocks.delete')) && (
                <>
                    <Dialog
                        open={creating !== null}
                        onOpenChange={(open: boolean) =>
                            !open && setCreating(null)
                        }
                    >
                        <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-6xl">
                            {creating !== null && (
                                <CreateIarForm
                                    prefill={creating.prefill}
                                    supplies={props.supplies}
                                    suppliers={props.suppliers}
                                    departments={props.departments}
                                    defaultIar={props.defaultIar}
                                    onClose={() => setCreating(null)}
                                />
                            )}
                        </DialogContent>
                    </Dialog>

                    <Dialog
                        open={editing !== null}
                        onOpenChange={(open: boolean) =>
                            !open && setEditing(null)
                        }
                    >
                        <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-2xl">
                            {editing !== null && (
                                <EditStockForm
                                    key={editing.stock_id}
                                    stock={editing}
                                    suppliers={props.suppliers}
                                    departments={props.departments}
                                    onClose={() => setEditing(null)}
                                />
                            )}
                        </DialogContent>
                    </Dialog>

                    <ConfirmDialog
                        open={deleting !== null}
                        onOpenChange={(open) => !open && setDeleting(null)}
                        title="Delete stock record?"
                        description={
                            deleting
                                ? `The stock record for ${deleting.supply?.item_name ?? 'this supply'} (fund ${deleting.fund_cluster ?? 'N/A'}) will be deleted. Transactions are kept.`
                                : undefined
                        }
                        confirmLabel="Delete"
                        destructive
                        processing={deleteProcessing}
                        onConfirm={confirmDelete}
                    />
                </>
            )}
        </>
    );
}

StocksIndex.layout = {
    breadcrumbs: [{ title: 'Stocks', href: stocksIndex() }],
};

/* -------------------------------------------------------------------------- */
/* New IAR (multi-item receipt)                                               */
/* -------------------------------------------------------------------------- */

type IarItem = {
    supply_id: string;
    quantity: string;
    unit_cost: string;
    fund_cluster: '101' | '151';
    status: StockStatus;
    expiry_date: string;
};

type IarForm = {
    reference_no: string;
    receipt_date: string;
    general_supplier_id: string;
    general_department_id: string;
    general_remarks: string;
    submission_token: string;
    items: IarItem[];
};

function newItem(prefill?: SupplyStock): IarItem {
    return {
        supply_id: prefill ? String(prefill.supply_id) : '',
        quantity: '1',
        unit_cost: prefill ? formatMoney(prefill.unit_cost) : '',
        fund_cluster: prefill?.fund_cluster === '151' ? '151' : '101',
        status: 'available',
        expiry_date: '',
    };
}

function CreateIarForm({
    prefill,
    supplies,
    suppliers,
    departments,
    defaultIar,
    onClose,
}: {
    prefill?: SupplyStock;
    supplies: Supply[];
    suppliers: Supplier[];
    departments: Department[];
    defaultIar: string;
    onClose: () => void;
}) {
    const form = useForm<IarForm>({
        reference_no: defaultIar,
        receipt_date: todayIso(),
        general_supplier_id: '',
        general_department_id: '',
        general_remarks: '',
        submission_token: submissionToken(),
        items: [newItem(prefill)],
    });

    const errors = form.errors as Record<string, string | undefined>;

    const supplyOptions = supplies
        .slice()
        .sort(
            (a, b) =>
                Number(a.stock_no) - Number(b.stock_no) ||
                a.stock_no.localeCompare(b.stock_no),
        )
        .map((supply) => ({
            value: String(supply.supply_id),
            label: supply.item_name,
            description: [supply.description, supply.unit_of_measurement]
                .filter(Boolean)
                .join(' · '),
            meta: `#${supply.stock_no}`,
        }));

    const changeDate = (value: string) => {
        form.setData('receipt_date', value);

        if (!value) {
            return;
        }

        getJson<{ defaultIar: string }>(nextIar.url(), { receipt_date: value })
            .then((response) =>
                form.setData('reference_no', response.defaultIar),
            )
            .catch(() => {
                // Keep whatever is in the field.
            });
    };

    const updateItem = (index: number, patch: Partial<IarItem>) => {
        form.setData(
            'items',
            form.data.items.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );
    };

    const grandTotal = form.data.items.reduce(
        (sum, item) => sum + toNumber(item.quantity) * toNumber(item.unit_cost),
        0,
    );

    const itemErrors = Object.entries(errors)
        .filter(([key]) => key.startsWith('items.'))
        .map(([key, message]) => {
            const match = /^items\.(\d+)\.(.+)$/.exec(key);

            return match
                ? `Row ${Number(match[1]) + 1} – ${match[2].replace(/_/g, ' ')}: ${message}`
                : String(message);
        });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.post(store.url(), {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onError: () => form.setData('submission_token', submissionToken()),
        });
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>
                    New Inspection and Acceptance Report (IAR)
                </DialogTitle>
                <DialogDescription>
                    Add all items received in this delivery.
                </DialogDescription>
            </DialogHeader>

            <form
                id="iar-form"
                onSubmit={submit}
                className="-mx-6 flex-1 space-y-6 overflow-y-auto px-6"
            >
                {itemErrors.length > 0 && (
                    <Alert variant="destructive">
                        <AlertTitle>Some items need attention</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4">
                                {itemErrors.map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <FormField
                        label="Receipt date"
                        htmlFor="receipt_date"
                        error={form.errors.receipt_date}
                        required
                    >
                        <Input
                            id="receipt_date"
                            type="date"
                            max={todayIso()}
                            value={form.data.receipt_date}
                            onChange={(e) => changeDate(e.target.value)}
                            required
                        />
                    </FormField>
                    <FormField
                        label="IAR reference"
                        htmlFor="reference_no"
                        error={form.errors.reference_no}
                        required
                    >
                        <Input
                            id="reference_no"
                            placeholder="IAR YYYY-MM-XXX"
                            value={form.data.reference_no}
                            onChange={(e) =>
                                form.setData('reference_no', e.target.value)
                            }
                            required
                        />
                    </FormField>
                    <FormField
                        label="Supplier (optional)"
                        htmlFor="general_supplier_id"
                        error={form.errors.general_supplier_id}
                    >
                        <NativeSelect
                            id="general_supplier_id"
                            value={form.data.general_supplier_id}
                            onChange={(e) =>
                                form.setData(
                                    'general_supplier_id',
                                    e.target.value,
                                )
                            }
                        >
                            <option value="">No supplier</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="Department (optional)"
                        htmlFor="general_department_id"
                        error={form.errors.general_department_id}
                    >
                        <NativeSelect
                            id="general_department_id"
                            value={form.data.general_department_id}
                            onChange={(e) =>
                                form.setData(
                                    'general_department_id',
                                    e.target.value,
                                )
                            }
                        >
                            <option value="">No department</option>
                            {departments.map((department) => (
                                <option
                                    key={department.id}
                                    value={department.id}
                                >
                                    {department.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="General remarks"
                        htmlFor="general_remarks"
                        error={form.errors.general_remarks}
                        className="md:col-span-2 lg:col-span-4"
                    >
                        <Input
                            id="general_remarks"
                            placeholder="e.g., PO #12345, DR #67890"
                            value={form.data.general_remarks}
                            onChange={(e) =>
                                form.setData('general_remarks', e.target.value)
                            }
                        />
                    </FormField>
                </section>

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium">Supply items</h3>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                form.setData('items', [
                                    ...form.data.items,
                                    newItem(),
                                ])
                            }
                        >
                            <Plus />
                            Add item
                        </Button>
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-64">
                                        Supply item
                                    </TableHead>
                                    <TableHead className="w-24">
                                        Quantity
                                    </TableHead>
                                    <TableHead className="w-32">
                                        Unit cost
                                    </TableHead>
                                    <TableHead className="w-32 text-right">
                                        Total cost
                                    </TableHead>
                                    <TableHead className="w-24">Fund</TableHead>
                                    <TableHead className="w-32">
                                        Status
                                    </TableHead>
                                    <TableHead className="w-40">
                                        Expiry
                                    </TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {form.data.items.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={8}
                                            className="py-8 text-center text-sm text-muted-foreground"
                                        >
                                            No items added yet. Click &quot;Add
                                            item&quot; to start.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    form.data.items.map((item, index) => (
                                        <TableRow
                                            key={index}
                                            className="align-top"
                                        >
                                            <TableCell className="whitespace-normal">
                                                <SearchableSelect
                                                    options={supplyOptions}
                                                    value={item.supply_id}
                                                    onChange={(value) =>
                                                        updateItem(index, {
                                                            supply_id: value,
                                                        })
                                                    }
                                                    placeholder="Select supply"
                                                    searchPlaceholder="Search supplies..."
                                                    invalid={Boolean(
                                                        errors[
                                                            `items.${index}.supply_id`
                                                        ],
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={item.quantity}
                                                    onChange={(e) =>
                                                        updateItem(index, {
                                                            quantity:
                                                                e.target.value,
                                                        })
                                                    }
                                                    aria-label="Quantity"
                                                    aria-invalid={
                                                        Boolean(
                                                            errors[
                                                                `items.${index}.quantity`
                                                            ],
                                                        ) || undefined
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    value={item.unit_cost}
                                                    onChange={(e) =>
                                                        updateItem(index, {
                                                            unit_cost:
                                                                e.target.value,
                                                        })
                                                    }
                                                    aria-label="Unit cost"
                                                    aria-invalid={
                                                        Boolean(
                                                            errors[
                                                                `items.${index}.unit_cost`
                                                            ],
                                                        ) || undefined
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="pt-4 text-right tabular-nums">
                                                {formatMoney(
                                                    toNumber(item.quantity) *
                                                        toNumber(
                                                            item.unit_cost,
                                                        ),
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <NativeSelect
                                                    value={item.fund_cluster}
                                                    onChange={(e) =>
                                                        updateItem(index, {
                                                            fund_cluster: e
                                                                .target
                                                                .value as
                                                                | '101'
                                                                | '151',
                                                        })
                                                    }
                                                    aria-label="Fund cluster"
                                                >
                                                    <option value="101">
                                                        101
                                                    </option>
                                                    <option value="151">
                                                        151
                                                    </option>
                                                </NativeSelect>
                                            </TableCell>
                                            <TableCell>
                                                <NativeSelect
                                                    value={item.status}
                                                    onChange={(e) =>
                                                        updateItem(index, {
                                                            status: e.target
                                                                .value as StockStatus,
                                                        })
                                                    }
                                                    aria-label="Status"
                                                >
                                                    {stockStatuses.map(
                                                        (status) => (
                                                            <option
                                                                key={status}
                                                                value={status}
                                                            >
                                                                {status
                                                                    .charAt(0)
                                                                    .toUpperCase() +
                                                                    status.slice(
                                                                        1,
                                                                    )}
                                                            </option>
                                                        ),
                                                    )}
                                                </NativeSelect>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="date"
                                                    value={item.expiry_date}
                                                    onChange={(e) =>
                                                        updateItem(index, {
                                                            expiry_date:
                                                                e.target.value,
                                                        })
                                                    }
                                                    aria-label="Expiry date"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        form.setData(
                                                            'items',
                                                            form.data.items.filter(
                                                                (_, i) =>
                                                                    i !== index,
                                                            ),
                                                        )
                                                    }
                                                    aria-label="Remove item"
                                                >
                                                    <Trash2 />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="text-right font-medium"
                                    >
                                        Grand total
                                    </TableCell>
                                    <TableCell className="text-right font-semibold tabular-nums">
                                        ₱{formatMoney(grandTotal)}
                                    </TableCell>
                                    <TableCell colSpan={4} />
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </section>
            </form>

            <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="iar-form"
                    disabled={form.processing || form.data.items.length === 0}
                >
                    Save IAR
                </Button>
            </DialogFooter>
        </>
    );
}

/* -------------------------------------------------------------------------- */
/* Re-value / edit stock                                                       */
/* -------------------------------------------------------------------------- */

type IarData = {
    unit_cost: string;
    status: StockStatus;
    expiry_date: string;
    fund_cluster: string | null;
    days_to_consume: number | null;
    remarks: string | null;
    supplier_id: number | null;
    department_id: number | null;
    receipt_date: string;
    reference_no: string;
    current_quantity: string;
    supply_name: string;
};

function EditStockForm({
    stock,
    suppliers,
    departments,
    onClose,
}: {
    stock: SupplyStock;
    suppliers: Supplier[];
    departments: Department[];
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [info, setInfo] = useState<Pick<
        IarData,
        'current_quantity' | 'supply_name'
    > | null>(null);

    const form = useForm({
        unit_cost: formatMoney(stock.unit_cost),
        supplier_id: stock.supplier_id ? String(stock.supplier_id) : '',
        department_id: stock.department_id ? String(stock.department_id) : '',
        expiry_date: stock.expiry_date ? stock.expiry_date.slice(0, 10) : '',
        status: stock.status,
        fund_cluster: stock.fund_cluster === '151' ? '151' : '101',
        days_to_consume:
            stock.days_to_consume !== null ? String(stock.days_to_consume) : '',
        remarks: stock.remarks ?? '',
        receipt_date: '',
        reference_no: '',
        submission_token: submissionToken(),
    });

    useEffect(() => {
        let cancelled = false;

        getJson<{ success: boolean; data: IarData }>(
            iarData.url(stock.stock_id),
        )
            .then((response) => {
                if (cancelled || !response.success) {
                    return;
                }

                const data = response.data;
                setInfo({
                    current_quantity: data.current_quantity,
                    supply_name: data.supply_name,
                });
                form.setData((current) => ({
                    ...current,
                    unit_cost: data.unit_cost,
                    supplier_id: data.supplier_id
                        ? String(data.supplier_id)
                        : '',
                    department_id: data.department_id
                        ? String(data.department_id)
                        : '',
                    expiry_date: data.expiry_date ?? '',
                    status: data.status,
                    fund_cluster: data.fund_cluster === '151' ? '151' : '101',
                    days_to_consume:
                        data.days_to_consume !== null
                            ? String(data.days_to_consume)
                            : '',
                    remarks: data.remarks ?? '',
                    receipt_date: data.receipt_date ?? '',
                    reference_no: data.reference_no ?? '',
                }));
            })
            .catch(() => {
                // Fall back to the values from the table row.
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stock.stock_id]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(update.url(stock.stock_id), {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onError: () => form.setData('submission_token', submissionToken()),
        });
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>Re-value stock</DialogTitle>
                <DialogDescription>
                    {info?.supply_name ?? stock.supply?.item_name} ·{' '}
                    {info?.current_quantity ??
                        `${formatNumber(stock.quantity_on_hand)} ${stock.supply?.unit_of_measurement ?? ''}`}{' '}
                    on hand. Changing the unit cost logs an adjustment
                    transaction.
                </DialogDescription>
            </DialogHeader>

            {loading ? (
                <div className="grid gap-3">
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ) : (
                <form
                    id="edit-stock-form"
                    onSubmit={submit}
                    className="-mx-6 grid flex-1 gap-4 overflow-y-auto px-6 sm:grid-cols-2"
                >
                    <FormField
                        label="Receipt date"
                        htmlFor="edit_receipt_date"
                        error={form.errors.receipt_date}
                    >
                        <Input
                            id="edit_receipt_date"
                            type="date"
                            max={todayIso()}
                            value={form.data.receipt_date}
                            onChange={(e) =>
                                form.setData('receipt_date', e.target.value)
                            }
                        />
                    </FormField>
                    <FormField
                        label="IAR reference"
                        htmlFor="edit_reference_no"
                        error={form.errors.reference_no}
                    >
                        <Input
                            id="edit_reference_no"
                            value={form.data.reference_no}
                            onChange={(e) =>
                                form.setData('reference_no', e.target.value)
                            }
                        />
                    </FormField>
                    <FormField
                        label="Unit cost"
                        htmlFor="edit_unit_cost"
                        error={form.errors.unit_cost}
                        required
                    >
                        <Input
                            id="edit_unit_cost"
                            inputMode="decimal"
                            value={form.data.unit_cost}
                            onChange={(e) =>
                                form.setData('unit_cost', e.target.value)
                            }
                            required
                        />
                    </FormField>
                    <FormField
                        label="Fund cluster"
                        htmlFor="edit_fund_cluster"
                        error={form.errors.fund_cluster}
                        required
                    >
                        <NativeSelect
                            id="edit_fund_cluster"
                            value={form.data.fund_cluster}
                            onChange={(e) =>
                                form.setData('fund_cluster', e.target.value)
                            }
                        >
                            <option value="101">101</option>
                            <option value="151">151</option>
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="Status"
                        htmlFor="edit_status"
                        error={form.errors.status}
                        required
                    >
                        <NativeSelect
                            id="edit_status"
                            value={form.data.status}
                            onChange={(e) =>
                                form.setData(
                                    'status',
                                    e.target.value as StockStatus,
                                )
                            }
                        >
                            {stockStatuses.map((status) => (
                                <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() +
                                        status.slice(1)}
                                </option>
                            ))}
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="Expiry date"
                        htmlFor="edit_expiry_date"
                        error={form.errors.expiry_date}
                    >
                        <Input
                            id="edit_expiry_date"
                            type="date"
                            value={form.data.expiry_date}
                            onChange={(e) =>
                                form.setData('expiry_date', e.target.value)
                            }
                        />
                    </FormField>
                    <FormField
                        label="Supplier"
                        htmlFor="edit_supplier_id"
                        error={form.errors.supplier_id}
                    >
                        <NativeSelect
                            id="edit_supplier_id"
                            value={form.data.supplier_id}
                            onChange={(e) =>
                                form.setData('supplier_id', e.target.value)
                            }
                        >
                            <option value="">No supplier</option>
                            {suppliers.map((supplier) => (
                                <option key={supplier.id} value={supplier.id}>
                                    {supplier.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="Department"
                        htmlFor="edit_department_id"
                        error={form.errors.department_id}
                    >
                        <NativeSelect
                            id="edit_department_id"
                            value={form.data.department_id}
                            onChange={(e) =>
                                form.setData('department_id', e.target.value)
                            }
                        >
                            <option value="">No department</option>
                            {departments.map((department) => (
                                <option
                                    key={department.id}
                                    value={department.id}
                                >
                                    {department.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="Days to consume"
                        htmlFor="edit_days_to_consume"
                        error={form.errors.days_to_consume}
                    >
                        <Input
                            id="edit_days_to_consume"
                            type="number"
                            min={0}
                            value={form.data.days_to_consume}
                            onChange={(e) =>
                                form.setData('days_to_consume', e.target.value)
                            }
                        />
                    </FormField>
                    <FormField
                        label="Remarks"
                        htmlFor="edit_remarks"
                        error={form.errors.remarks}
                        className="sm:col-span-2"
                    >
                        <Textarea
                            id="edit_remarks"
                            rows={2}
                            value={form.data.remarks}
                            onChange={(e) =>
                                form.setData('remarks', e.target.value)
                            }
                        />
                    </FormField>
                </form>
            )}

            <DialogFooter className="border-t pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    form="edit-stock-form"
                    disabled={loading || form.processing}
                >
                    Save changes
                </Button>
            </DialogFooter>
        </>
    );
}
