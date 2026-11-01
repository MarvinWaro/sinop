import { Head, useForm } from '@inertiajs/react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import Heading from '@/components/heading';
import { RowActions } from '@/components/row-actions';
import { SearchForm } from '@/components/search-form';
import { ConditionBadge } from '@/components/status-badges';
import { TablePanel } from '@/components/table-panel';
import { Badge } from '@/components/ui/badge';
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
import { useCan } from '@/hooks/use-can';
import { useDeleteAction } from '@/hooks/use-delete-action';
import { formatNumber } from '@/lib/format';
import {
    destroy,
    index as conditionsIndex,
    store,
    update,
} from '@/routes/property-conditions';
import type { Paginated } from '@/types';

type ConditionRow = {
    id: number;
    name: string;
    /** Active properties in this condition. */
    properties_count: number;
    /** Serviceable and Unserviceable: counted on the assets overview. */
    built_in: boolean;
};

type Props = {
    conditions: Paginated<ConditionRow>;
    filters: { search: string | null };
};

/**
 * Settings › Property conditions: what the property form offers (admins can
 * also add one there by typing it). Renaming updates the properties that
 * use it; a condition in use can't be deleted; the two built-in ones stay.
 */
export default function PropertyConditionsIndex({
    conditions,
    filters,
}: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<ConditionRow | 'new' | null>(null);
    const deletion = useDeleteAction<ConditionRow>((item) =>
        destroy.url(item.id),
    );

    return (
        <>
            <Head title="Property conditions" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Property conditions"
                    description="The conditions a property can be in. Admins can also add one while adding a property."
                    actions={
                        can('property-conditions.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add condition
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={conditionsIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search conditions..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Condition</TableHead>
                                    <TableHead className="text-right">
                                        Properties
                                    </TableHead>
                                    <TableHead className="w-28 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {conditions.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <EmptyState
                                                icon={ClipboardCheck}
                                                title="No conditions found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    conditions.data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="whitespace-normal">
                                                <span className="flex flex-wrap items-center gap-2">
                                                    <ConditionBadge
                                                        condition={item.name}
                                                    />
                                                    {item.built_in && (
                                                        <Badge
                                                            variant="outline"
                                                            className="font-normal text-muted-foreground"
                                                        >
                                                            Built in
                                                        </Badge>
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground tabular-nums">
                                                {formatNumber(
                                                    item.properties_count,
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <RowActions
                                                    label={item.name}
                                                    onEdit={
                                                        !item.built_in &&
                                                        can(
                                                            'property-conditions.update',
                                                        )
                                                            ? () =>
                                                                  setEditing(
                                                                      item,
                                                                  )
                                                            : undefined
                                                    }
                                                    onDelete={
                                                        !item.built_in &&
                                                        item.properties_count ===
                                                            0 &&
                                                        can(
                                                            'property-conditions.delete',
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

                    <p className="text-xs text-muted-foreground">
                        Serviceable and Unserviceable are built in (the assets
                        overview counts them). A condition still used by a
                        property can&apos;t be deleted.
                    </p>

                    <DataPagination paginator={conditions} />
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
                title="Delete condition?"
                description={
                    deletion.target
                        ? `“${deletion.target.name}” will be removed from the list.`
                        : undefined
                }
                confirmLabel="Delete condition"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

PropertyConditionsIndex.layout = {
    breadcrumbs: [{ title: 'Property conditions', href: conditionsIndex() }],
};

function NameForm({
    item,
    onClose,
}: {
    item: ConditionRow | null;
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
                    {item ? 'Rename condition' : 'Add condition'}
                </DialogTitle>
                <DialogDescription>
                    {item
                        ? `Properties marked “${item.name}” (${item.properties_count}) will show the new name.`
                        : 'For example “For repair” or “Disposed”.'}
                </DialogDescription>
            </DialogHeader>
            <FormField
                label="Condition"
                htmlFor="name"
                error={form.errors.name}
                required
            >
                <Input
                    id="name"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    placeholder="e.g. For repair"
                    maxLength={50}
                    required
                    autoFocus
                />
            </FormField>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {item ? 'Save' : 'Add condition'}
                </Button>
            </DialogFooter>
        </form>
    );
}
