import { Head, useForm } from '@inertiajs/react';
import { Building2, Plus } from 'lucide-react';
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
import { useDeleteAction } from '@/hooks/use-delete-action';
import { useCan } from '@/hooks/use-can';
import {
    destroy,
    index as departmentsIndex,
    store,
    update,
} from '@/routes/departments';
import type { Department, Paginated } from '@/types';

type Props = {
    departments: Paginated<Department>;
    filters: { search: string | null };
};

export default function DepartmentsIndex({ departments, filters }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<Department | 'new' | null>(null);
    const deletion = useDeleteAction<Department>((item) =>
        destroy.url(item.id),
    );

    return (
        <>
            <Head title="Divisions" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Divisions"
                    description="CHED divisions that request supplies"
                    actions={
                        can('divisions.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add division
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={departmentsIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search divisions..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="w-28 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {departments.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <EmptyState
                                                icon={Building2}
                                                title="No divisions found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    departments.data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-muted-foreground">
                                                {item.id}
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-normal">
                                                {item.name}
                                            </TableCell>
                                            <TableCell>
                                                <RowActions
                                                    label={item.name}
                                                    onEdit={
                                                        can('divisions.update')
                                                            ? () =>
                                                                  setEditing(
                                                                      item,
                                                                  )
                                                            : undefined
                                                    }
                                                    onDelete={
                                                        can('divisions.delete')
                                                            ? () =>
                                                                  deletion.request(
                                                                      item,
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

                    <DataPagination paginator={departments} />
                </div>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open: boolean) => !open && setEditing(null)}
            >
                <DialogContent>
                    {editing !== null && (
                        <NameForm
                            key={editing === 'new' ? 'new' : editing.id}
                            item={editing === 'new' ? null : editing}
                            onClose={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deletion.target !== null}
                onOpenChange={(open) => !open && deletion.cancel()}
                title="Delete division?"
                description={
                    deletion.target
                        ? `“${deletion.target.name}” will be permanently deleted.`
                        : undefined
                }
                confirmLabel="Delete division"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

DepartmentsIndex.layout = {
    breadcrumbs: [{ title: 'Divisions', href: departmentsIndex() }],
};

function NameForm({
    item,
    onClose,
}: {
    item: Department | null;
    onClose: () => void;
}) {
    const form = useForm({ name: item?.name ?? '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const options = { preserveScroll: true, onSuccess: () => onClose() };

        if (item) {
            form.put(update.url(item.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    return (
        <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>
                    {item ? 'Edit division' : 'Add division'}
                </DialogTitle>
                <DialogDescription>
                    {item
                        ? 'Update the division name.'
                        : 'Create a new division.'}
                </DialogDescription>
            </DialogHeader>
            <FormField
                label="Name"
                htmlFor="name"
                error={form.errors.name}
                required
            >
                <Input
                    id="name"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder="Enter division name"
                    required
                    autoFocus
                />
            </FormField>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {item ? 'Save changes' : 'Add division'}
                </Button>
            </DialogFooter>
        </form>
    );
}
