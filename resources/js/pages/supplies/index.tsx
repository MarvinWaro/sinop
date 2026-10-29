import { Head, router, useForm } from '@inertiajs/react';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { PageContainer, PageHeader } from '@/components/page-header';
import { SearchForm } from '@/components/search-form';
import { TablePanel } from '@/components/table-panel';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import {
    destroy,
    index as suppliesIndex,
    store,
    update,
} from '@/routes/supplies';
import type { Category, Paginated, Supply } from '@/types';

type Props = {
    categories: Category[];
    supplies: Paginated<Supply>;
    filters: { search: string | null };
};

export const unitOptions = [
    ['PIECE', 'PIECE (PCS)'],
    ['BOX', 'BOX'],
    ['REAM', 'REAM'],
    ['GALLON', 'GALLON'],
    ['LITRE', 'LITRE (L)'],
    ['PACK', 'PACK'],
    ['PAIR', 'PAIR'],
    ['CAN', 'CAN'],
    ['SET', 'SET'],
    ['ROLL', 'ROLL'],
    ['BOTTLE', 'BOTTLE'],
    ['PAD', 'PAD'],
    ['POUCH', 'POUCH'],
    ['SHEET', 'SHEET'],
] as const;

export default function SuppliesIndex({
    categories,
    supplies,
    filters,
}: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<Supply | 'new' | null>(null);
    const [deleting, setDeleting] = useState<Supply | null>(null);
    const [deleteProcessing, setDeleteProcessing] = useState(false);

    const confirmDelete = () => {
        if (!deleting) {
            return;
        }

        router.delete(destroy.url(deleting.supply_id), {
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
            <Head title="Supplies" />
            <PageContainer>
                <PageHeader
                    title="Supplies"
                    description="Supply items, units and reorder points"
                    actions={
                        can('supplies.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add supply
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={suppliesIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search stock no, item, description..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-14">ID</TableHead>
                                    <TableHead>Stock no</TableHead>
                                    <TableHead>Item details</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead className="text-right">
                                        Reorder point
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {supplies.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7}>
                                            <EmptyState
                                                icon={Package}
                                                title="No supplies found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    supplies.data.map((supply) => (
                                        <TableRow key={supply.supply_id}>
                                            <TableCell className="text-muted-foreground">
                                                {supply.supply_id}
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {supply.stock_no}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                <p className="font-medium">
                                                    {supply.item_name}
                                                </p>
                                                {supply.description && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {supply.description}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-56 truncate">
                                                {supply.category?.name ?? (
                                                    <span className="text-muted-foreground">
                                                        Uncategorized
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {supply.unit_of_measurement}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {supply.reorder_point}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    {can('supplies.update') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setEditing(
                                                                    supply,
                                                                )
                                                            }
                                                            aria-label={`Edit ${supply.item_name}`}
                                                        >
                                                            <Pencil />
                                                        </Button>
                                                    )}
                                                    {can('supplies.delete') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setDeleting(
                                                                    supply,
                                                                )
                                                            }
                                                            aria-label={`Delete ${supply.item_name}`}
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>

                    <DataPagination paginator={supplies} />
                </div>
            </PageContainer>

            <Dialog
                open={editing !== null}
                onOpenChange={(open: boolean) => !open && setEditing(null)}
            >
                <DialogContent className="sm:max-w-xl">
                    {editing !== null && (
                        <SupplyForm
                            key={editing === 'new' ? 'new' : editing.supply_id}
                            supply={editing === 'new' ? null : editing}
                            categories={categories}
                            onClose={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title="Delete supply?"
                description={
                    deleting
                        ? `${deleting.item_name} (${deleting.stock_no}) and its stock records and transactions will be permanently deleted.`
                        : undefined
                }
                confirmLabel="Delete"
                destructive
                processing={deleteProcessing}
                onConfirm={confirmDelete}
            />
        </>
    );
}

SuppliesIndex.layout = {
    breadcrumbs: [{ title: 'Supplies', href: suppliesIndex() }],
};

function SupplyForm({
    supply,
    categories,
    onClose,
}: {
    supply: Supply | null;
    categories: Category[];
    onClose: () => void;
}) {
    const form = useForm({
        stock_no: supply?.stock_no ?? '',
        item_name: supply?.item_name ?? '',
        description: supply?.description ?? '',
        unit_of_measurement: supply?.unit_of_measurement ?? '',
        category_id: supply?.category_id ? String(supply.category_id) : '',
        reorder_point: supply ? String(supply.reorder_point) : '0',
        acquisition_cost: supply ? supply.acquisition_cost : '',
    });

    const units: string[] = unitOptions.map(([value]) => value);
    const hasCustomUnit =
        form.data.unit_of_measurement !== '' &&
        !units.includes(form.data.unit_of_measurement);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const options = { preserveScroll: true, onSuccess: () => onClose() };

        if (supply) {
            form.put(update.url(supply.supply_id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    return (
        <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>
                    {supply ? 'Edit supply' : 'Add supply'}
                </DialogTitle>
                <DialogDescription>
                    {supply
                        ? 'Update the supply details.'
                        : 'A depleted stock record is created automatically so the item shows up in Stocks.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    label="Stock no."
                    htmlFor="stock_no"
                    error={form.errors.stock_no}
                    required
                >
                    <Input
                        id="stock_no"
                        value={form.data.stock_no}
                        onChange={(e) =>
                            form.setData('stock_no', e.target.value)
                        }
                        required
                    />
                </FormField>
                <FormField
                    label="Unit of measurement"
                    htmlFor="unit_of_measurement"
                    error={form.errors.unit_of_measurement}
                    required
                >
                    <NativeSelect
                        id="unit_of_measurement"
                        value={form.data.unit_of_measurement}
                        onChange={(e) =>
                            form.setData('unit_of_measurement', e.target.value)
                        }
                        required
                    >
                        <option value="" disabled>
                            Select unit
                        </option>
                        {hasCustomUnit && (
                            <option value={form.data.unit_of_measurement}>
                                {form.data.unit_of_measurement}
                            </option>
                        )}
                        {unitOptions.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </NativeSelect>
                </FormField>
                <FormField
                    label="Item name"
                    htmlFor="item_name"
                    error={form.errors.item_name}
                    required
                    className="sm:col-span-2"
                >
                    <Input
                        id="item_name"
                        value={form.data.item_name}
                        onChange={(e) =>
                            form.setData('item_name', e.target.value)
                        }
                        className="uppercase"
                        required
                    />
                </FormField>
                <FormField
                    label="Description"
                    htmlFor="description"
                    error={form.errors.description}
                    className="sm:col-span-2"
                >
                    <Textarea
                        id="description"
                        rows={2}
                        value={form.data.description}
                        onChange={(e) =>
                            form.setData('description', e.target.value)
                        }
                    />
                </FormField>
                <FormField
                    label="Category"
                    htmlFor="category_id"
                    error={form.errors.category_id}
                >
                    <NativeSelect
                        id="category_id"
                        value={form.data.category_id}
                        onChange={(e) =>
                            form.setData('category_id', e.target.value)
                        }
                    >
                        <option value="">Uncategorized</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </NativeSelect>
                </FormField>
                <FormField
                    label="Reorder point"
                    htmlFor="reorder_point"
                    error={form.errors.reorder_point}
                    required
                >
                    <Input
                        id="reorder_point"
                        type="number"
                        min={0}
                        value={form.data.reorder_point}
                        onChange={(e) =>
                            form.setData('reorder_point', e.target.value)
                        }
                        required
                    />
                </FormField>
                <FormField
                    label="Acquisition cost"
                    htmlFor="acquisition_cost"
                    error={form.errors.acquisition_cost}
                >
                    <Input
                        id="acquisition_cost"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={form.data.acquisition_cost}
                        onChange={(e) =>
                            form.setData('acquisition_cost', e.target.value)
                        }
                    />
                </FormField>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {supply ? 'Save changes' : 'Add supply'}
                </Button>
            </DialogFooter>
        </form>
    );
}
