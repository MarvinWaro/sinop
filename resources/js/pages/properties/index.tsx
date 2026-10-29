import { Head, Link } from '@inertiajs/react';
import { Armchair, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { SearchForm } from '@/components/search-form';
import { ConditionBadge } from '@/components/status-badges';
import { TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
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
    create,
    destroy,
    edit,
    index as propertiesIndex,
    view,
} from '@/routes/property';
import type { Paginated, Property } from '@/types';

type Props = {
    properties: Paginated<Property>;
    filters: { search: string | null };
};

export default function PropertiesIndex({ properties, filters }: Props) {
    const can = useCan();
    const deletion = useDeleteAction<Property>((property) =>
        destroy.url(property.id),
    );

    return (
        <>
            <Head title="Properties" />
            <PageContainer>
                <PageHeader
                    title="Properties"
                    description="Equipment and furniture with their accountable officers (MR)"
                    actions={
                        can('properties.create') && (
                            <Button asChild>
                                <Link href={create()}>
                                    <Plus />
                                    Add property
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="space-y-4">
                    <div className="flex justify-end">
                        <SearchForm
                            url={propertiesIndex.url()}
                            defaultValue={filters.search}
                            placeholder="Search item, serial, holder, location..."
                        />
                    </div>

                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">ID</TableHead>
                                    <TableHead>Property no.</TableHead>
                                    <TableHead>Item name</TableHead>
                                    <TableHead>Fund</TableHead>
                                    <TableHead>Assigned to</TableHead>
                                    <TableHead>Condition</TableHead>
                                    <TableHead className="w-32 text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {properties.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7}>
                                            <EmptyState
                                                icon={Armchair}
                                                title="No properties found"
                                                description={
                                                    filters.search
                                                        ? 'Try a different search.'
                                                        : 'Get started by adding a new property.'
                                                }
                                                action={
                                                    !filters.search &&
                                                    can(
                                                        'properties.create',
                                                    ) && (
                                                        <Button
                                                            asChild
                                                            size="sm"
                                                        >
                                                            <Link
                                                                href={create()}
                                                            >
                                                                <Plus />
                                                                Add property
                                                            </Link>
                                                        </Button>
                                                    )
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    properties.data.map((property) => (
                                        <TableRow key={property.id}>
                                            <TableCell className="text-muted-foreground">
                                                {property.id}
                                            </TableCell>
                                            <TableCell className="font-mono">
                                                {property.property_number}
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-normal">
                                                {property.item_name}
                                            </TableCell>
                                            <TableCell>
                                                {property.fund ?? 'TBD'}
                                            </TableCell>
                                            <TableCell>
                                                {property.user?.name ?? 'TBD'}
                                            </TableCell>
                                            <TableCell>
                                                <ConditionBadge
                                                    condition={
                                                        property.condition
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="icon"
                                                        title="View"
                                                    >
                                                        <Link
                                                            href={view(
                                                                property.id,
                                                            )}
                                                            aria-label={`View ${property.item_name}`}
                                                        >
                                                            <Eye />
                                                        </Link>
                                                    </Button>
                                                    {can(
                                                        'properties.update',
                                                    ) && (
                                                        <Button
                                                            asChild
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Edit"
                                                        >
                                                            <Link
                                                                href={edit(
                                                                    property.id,
                                                                )}
                                                                aria-label={`Edit ${property.item_name}`}
                                                            >
                                                                <Pencil />
                                                            </Link>
                                                        </Button>
                                                    )}
                                                    {can(
                                                        'properties.delete',
                                                    ) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Remove"
                                                            onClick={() =>
                                                                deletion.request(
                                                                    property,
                                                                )
                                                            }
                                                            aria-label={`Remove ${property.item_name}`}
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

                    <DataPagination paginator={properties} />
                </div>
            </PageContainer>

            <ConfirmDialog
                open={deletion.target !== null}
                onOpenChange={(open) => !open && deletion.cancel()}
                title="Remove property?"
                description={
                    deletion.target
                        ? `${deletion.target.item_name} (${deletion.target.property_number}) will be removed from the property list.`
                        : undefined
                }
                confirmLabel="Remove property"
                destructive
                processing={deletion.processing}
                onConfirm={deletion.confirm}
            />
        </>
    );
}

PropertiesIndex.layout = {
    breadcrumbs: [{ title: 'Properties', href: propertiesIndex() }],
};
