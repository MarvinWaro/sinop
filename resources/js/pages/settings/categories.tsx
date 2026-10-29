import { Head, useForm } from '@inertiajs/react';
import { Plus, Tags } from 'lucide-react';
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
    index as categoriesIndex,
    store,
    update,
} from '@/routes/categories';
import type { Category, Paginated } from '@/types';

type Props = {
    categories: Paginated<Category>;
    filters: { search: string | null };
};

export default function CategoriesIndex({ categories, filters }: Props) {
    const can = useCan();
    const [editing, setEditing] = useState<Category | 'new' | null>(null);
    const deletion = useDeleteAction<Category>((category) =>
        destroy.url(category.id),
    );

    return (
        <>
            <Head title="Categories" />
            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Categories"
                    description="Supply categories used to group items"
                    actions={
                        can('categories.create') && (
                            <Button onClick={() => setEditing('new')}>
                                <Plus />
                                Add category
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={categoriesIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search categories..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-28 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4}>
                                            <EmptyState
                                                icon={Tags}
                                                title="No categories found"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    categories.data.map((category) => (
                                        <TableRow key={category.id}>
                                            <TableCell className="text-muted-foreground">
                                                {category.id}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {category.name}
                                            </TableCell>
                                            <TableCell className="max-w-xl whitespace-normal text-muted-foreground">
                                                {category.description || '—'}
                                            </TableCell>
                                            <TableCell>
                                                <RowActions
                                                    label={category.name}
                                                    onEdit={
                                                        can('categories.update')
                                                            ? () =>
                                                                  setEditing(
                                                                      category,
                                                                  )
                                                            : undefined
                                                    }
                                                    onDelete={
                                                        can('categories.delete')
                                                            ? () =>
                                                                  deletion.request(
                                                                      category,
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

                    <DataPagination paginator={categories} />
                </div>
            </div>

            <Dialog
                open={editing !== null}
                onOpenChange={(open: boolean) => !open && setEditing(null)}
            >
                <DialogContent>
                    {editing !== null && (
                        <CategoryForm
                            key={editing === 'new' ? 'new' : editing.id}
                            category={editing === 'new' ? null : editing}
                            onClose={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={deletion.target !== null}
                onOpenChange={(open) => !open && deletion.cancel()}
                title="Delete category?"
                description={
                    deletion.target
                        ? `“${deletion.target.name}” will be permanently deleted.`
                        : undefined
                }
                confirmLabel="Delete category"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

CategoriesIndex.layout = {
    breadcrumbs: [{ title: 'Categories', href: categoriesIndex() }],
};

function CategoryForm({
    category,
    onClose,
}: {
    category: Category | null;
    onClose: () => void;
}) {
    const form = useForm({
        name: category?.name ?? '',
        description: category?.description ?? '',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const options = { preserveScroll: true, onSuccess: () => onClose() };

        if (category) {
            form.put(update.url(category.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    return (
        <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
                <DialogTitle>
                    {category ? 'Edit category' : 'Add category'}
                </DialogTitle>
                <DialogDescription>
                    {category
                        ? 'Update the category details.'
                        : 'Create a new supply category.'}
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
                    placeholder="Enter category name"
                    required
                    autoFocus
                />
            </FormField>
            <FormField
                label="Description"
                htmlFor="description"
                error={form.errors.description}
            >
                <Textarea
                    id="description"
                    rows={3}
                    value={form.data.description}
                    onChange={(e) =>
                        form.setData('description', e.target.value)
                    }
                    placeholder="Enter category description"
                />
            </FormField>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={form.processing}>
                    {category ? 'Save changes' : 'Add category'}
                </Button>
            </DialogFooter>
        </form>
    );
}
