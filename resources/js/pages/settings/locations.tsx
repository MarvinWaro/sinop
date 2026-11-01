import { Head, useForm } from '@inertiajs/react';
import { MapPin, Plus } from 'lucide-react';
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
    index as locationsIndex,
    store,
    update,
} from '@/routes/location';
import type { Location, Paginated } from '@/types';

type Props = {
    locations: Paginated<Location>;
    filters: { search: string | null };
};

export default function LocationsIndex({ locations, filters }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<Location | 'new' | null>(null);
    const deletion = useDeleteAction<Location>((item) => destroy.url(item.id));

    return (
        <>
            <Head title="Property locations" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Property locations"
                    description="Where properties are kept or assigned. Admins can also add one while adding a property."
                    actions={
                        can('locations.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add property location
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={locationsIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search property locations..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Property location</TableHead>
                                    <TableHead className="w-28 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {locations.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <EmptyState
                                                icon={MapPin}
                                                title="No property locations found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    locations.data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="text-muted-foreground">
                                                {item.id}
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-normal">
                                                {item.location_name}
                                            </TableCell>
                                            <TableCell>
                                                <RowActions
                                                    label={item.location_name}
                                                    onEdit={
                                                        can('locations.update')
                                                            ? () =>
                                                                  setEditing(
                                                                      item,
                                                                  )
                                                            : undefined
                                                    }
                                                    onDelete={
                                                        can('locations.delete')
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

                    <DataPagination paginator={locations} />
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
                title="Delete property location?"
                description={
                    deletion.target
                        ? `“${deletion.target.location_name}” will be removed from the list.`
                        : undefined
                }
                confirmLabel="Delete property location"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

LocationsIndex.layout = {
    breadcrumbs: [{ title: 'Property locations', href: locationsIndex() }],
};

function NameForm({
    item,
    onClose,
}: {
    item: Location | null;
    onClose: () => void;
}) {
    const form = useForm({ location_name: item?.location_name ?? '' });

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
                    {item ? 'Edit property location' : 'Add property location'}
                </DialogTitle>
                <DialogDescription>
                    {item
                        ? 'Rename this property location.'
                        : 'Where a property is kept, e.g. “ICT room, 3rd floor”.'}
                </DialogDescription>
            </DialogHeader>
            <FormField
                label="Property location"
                htmlFor="location_name"
                error={form.errors.location_name}
                required
            >
                <Input
                    id="location_name"
                    value={form.data.location_name}
                    onChange={(e) =>
                        form.setData('location_name', e.target.value)
                    }
                    placeholder="e.g. ICT room, 3rd floor"
                    required
                    autoFocus
                />
            </FormField>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {item ? 'Save changes' : 'Add property location'}
                </Button>
            </DialogFooter>
        </form>
    );
}
