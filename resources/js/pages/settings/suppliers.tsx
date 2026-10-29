import { Head, useForm } from '@inertiajs/react';
import { Plus, Truck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import Heading from '@/components/heading';
import { RowActions } from '@/components/row-actions';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useDeleteAction } from '@/hooks/use-delete-action';
import { useCan } from '@/hooks/use-can';
import {
    destroy,
    index as suppliersIndex,
    store,
    update,
} from '@/routes/supplier';
import type { Paginated, Supplier } from '@/types';

type Props = {
    suppliers: Paginated<Supplier>;
    filters: { search: string | null };
};

export default function SuppliersIndex({ suppliers, filters }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
    const deletion = useDeleteAction<Supplier>((supplier) =>
        destroy.url(supplier.id),
    );

    return (
        <>
            <Head title="Suppliers" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Suppliers"
                    description="Vendors referenced on IARs and stock receipts"
                    actions={
                        can('suppliers.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add supplier
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={suppliersIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search suppliers..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Name / email</TableHead>
                                    <TableHead>Contact person</TableHead>
                                    <TableHead>Contact no.</TableHead>
                                    <TableHead className="w-28 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {suppliers.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5}>
                                            <EmptyState
                                                icon={Truck}
                                                title="No suppliers found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    suppliers.data.map((supplier) => (
                                        <TableRow key={supplier.id}>
                                            <TableCell className="text-muted-foreground">
                                                {supplier.id}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                <p className="font-medium">
                                                    {supplier.name}
                                                </p>
                                                {supplier.email && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {supplier.email}
                                                    </p>
                                                )}
                                                {supplier.address && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {supplier.address}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {supplier.contact_person || '—'}
                                            </TableCell>
                                            <TableCell className="tabular-nums">
                                                {supplier.contact_number}
                                            </TableCell>
                                            <TableCell>
                                                <RowActions
                                                    label={supplier.name}
                                                    onEdit={
                                                        can('suppliers.update')
                                                            ? () =>
                                                                  setEditing(
                                                                      supplier,
                                                                  )
                                                            : undefined
                                                    }
                                                    onDelete={
                                                        can('suppliers.delete')
                                                            ? () =>
                                                                  deletion.request(
                                                                      supplier,
                                                                  )
                                                            : undefined
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TablePanel>

                    <DataPagination paginator={suppliers} />
                </div>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open: boolean) => !open && setEditing(null)}
            >
                <DialogContent className="sm:max-w-xl">
                    {editing !== null && (
                        <SupplierForm
                            key={editing === 'new' ? 'new' : editing.id}
                            supplier={editing === 'new' ? null : editing}
                            onClose={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deletion.target !== null}
                onOpenChange={(open) => !open && deletion.cancel()}
                title="Delete supplier?"
                description={
                    deletion.target
                        ? `“${deletion.target.name}” will be permanently deleted.`
                        : undefined
                }
                confirmLabel="Delete supplier"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

SuppliersIndex.layout = {
    breadcrumbs: [{ title: 'Suppliers', href: suppliersIndex() }],
};

function SupplierForm({
    supplier,
    onClose,
}: {
    supplier: Supplier | null;
    onClose: () => void;
}) {
    const form = useForm({
        name: supplier?.name ?? '',
        email: supplier?.email ?? '',
        contact_no: supplier?.contact_number ?? '',
        contact_person: supplier?.contact_person ?? '',
        address: supplier?.address ?? '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const options = { preserveScroll: true, onSuccess: () => onClose() };

        if (supplier) {
            form.put(update.url(supplier.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    return (
        <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>
                    {supplier ? 'Edit supplier' : 'Add supplier'}
                </DialogTitle>
                <DialogDescription>
                    {supplier
                        ? 'Update the supplier details.'
                        : 'Register a new supplier.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    label="Supplier name"
                    htmlFor="name"
                    error={form.errors.name}
                    required
                    className="sm:col-span-2"
                >
                    <Input
                        id="name"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                        placeholder="Enter supplier name"
                        required
                        autoFocus
                    />
                </FormField>
                <FormField
                    label="Email"
                    htmlFor="email"
                    error={form.errors.email}
                >
                    <Input
                        id="email"
                        type="email"
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        placeholder="eg. juan@gmail.com"
                    />
                </FormField>
                <FormField
                    label="Contact no."
                    htmlFor="contact_no"
                    error={form.errors.contact_no}
                    required
                >
                    <Input
                        id="contact_no"
                        inputMode="tel"
                        maxLength={15}
                        value={form.data.contact_no}
                        onChange={(e) =>
                            form.setData('contact_no', e.target.value)
                        }
                        placeholder="eg. 09261337822"
                        required
                    />
                </FormField>
                <FormField
                    label="Contact person"
                    htmlFor="contact_person"
                    error={form.errors.contact_person}
                    className="sm:col-span-2"
                >
                    <Input
                        id="contact_person"
                        value={form.data.contact_person}
                        onChange={(e) =>
                            form.setData('contact_person', e.target.value)
                        }
                        placeholder="Enter contact person"
                    />
                </FormField>
                <FormField
                    label="Address"
                    htmlFor="address"
                    error={form.errors.address}
                    className="sm:col-span-2"
                >
                    <Textarea
                        id="address"
                        rows={2}
                        value={form.data.address}
                        onChange={(e) =>
                            form.setData('address', e.target.value)
                        }
                        placeholder="Enter address"
                    />
                </FormField>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {supplier ? 'Save changes' : 'Add supplier'}
                </Button>
            </DialogFooter>
        </form>
    );
}
