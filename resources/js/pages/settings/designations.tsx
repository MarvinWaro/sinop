import { Head, useForm } from '@inertiajs/react';
import { BadgeCheck, Plus } from 'lucide-react';
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
    index as designationsIndex,
    store,
    update,
} from '@/routes/designations';
import type { Designation, Paginated } from '@/types';

type Props = {
    designations: Paginated<Designation>;
    filters: { search: string | null };
};

export default function DesignationsIndex({ designations, filters }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<Designation | 'new' | null>(null);
    const deletion = useDeleteAction<Designation>((item) =>
        destroy.url(item.id),
    );

    return (
        <>
            <Head title="Designations" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Designations"
                    description="Job titles assigned to employees"
                    actions={
                        can('designations.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add designation
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={designationsIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search designations..."
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
                                {designations.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <EmptyState
                                                icon={BadgeCheck}
                                                title="No designations found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    designations.data.map((item) => (
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
                                                        can(
                                                            'designations.update',
                                                        )
                                                            ? () =>
                                                                  setEditing(
                                                                      item,
                                                                  )
                                                            : undefined
                                                    }
                                                    onDelete={
                                                        can(
                                                            'designations.delete',
                                                        )
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

                    <DataPagination paginator={designations} />
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
                title="Delete designation?"
                description={
                    deletion.target
                        ? `“${deletion.target.name}” will be permanently deleted.`
                        : undefined
                }
                confirmLabel="Delete designation"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

DesignationsIndex.layout = {
    breadcrumbs: [{ title: 'Designations', href: designationsIndex() }],
};

function NameForm({
    item,
    onClose,
}: {
    item: Designation | null;
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
                    {item ? 'Edit designation' : 'Add designation'}
                </DialogTitle>
                <DialogDescription>
                    {item
                        ? 'Update the designation name.'
                        : 'Create a new designation.'}
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
                    placeholder="Enter designation name"
                    required
                    autoFocus
                />
            </FormField>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {item ? 'Save changes' : 'Add designation'}
                </Button>
            </DialogFooter>
        </form>
    );
}
