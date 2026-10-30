import { Head } from '@inertiajs/react';
import { ImageOff, Laptop } from 'lucide-react';
import { useState } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { UserModeNotice } from '@/components/staff/user-mode-notice';
import { ConditionBadge } from '@/components/status-badges';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatPeso } from '@/lib/format';
import { properties as staffProperties } from '@/routes/staff';
import type { Paginated, Property } from '@/types';

type Props = {
    properties: Paginated<Property>;
};

export default function StaffProperties({ properties }: Props) {
    const [viewing, setViewing] = useState<Property | null>(null);

    return (
        <>
            <Head title="My properties" />
            <PageContainer>
                <UserModeNotice />
                <PageHeader
                    title="My properties"
                    description="Property and equipment under your accountability (MR)"
                />

                <div className="space-y-4">
                    {properties.data.length === 0 ? (
                        <EmptyState
                            icon={Laptop}
                            title="No properties assigned"
                            description="Properties assigned to you will appear here."
                        />
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {properties.data.map((property) => (
                                <button
                                    key={property.id}
                                    type="button"
                                    onClick={() => setViewing(property)}
                                    className="overflow-hidden rounded-xl border bg-card text-left transition-colors hover:bg-muted/50"
                                >
                                    <div className="flex aspect-video items-center justify-center bg-muted">
                                        {property.images?.[0] ? (
                                            <img
                                                src={property.images[0].url}
                                                alt={property.item_name}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <ImageOff className="size-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="space-y-1 p-4">
                                        <p className="font-medium">
                                            {property.item_name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {property.property_number}
                                        </p>
                                        <ConditionBadge
                                            condition={property.condition}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                    <DataPagination paginator={properties} />
                </div>
            </PageContainer>

            <Dialog
                open={viewing !== null}
                onOpenChange={(open: boolean) => !open && setViewing(null)}
            >
                <DialogContent className="sm:max-w-xl">
                    {viewing && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{viewing.item_name}</DialogTitle>
                                <DialogDescription>
                                    {viewing.property_number}
                                </DialogDescription>
                            </DialogHeader>
                            {viewing.images && viewing.images.length > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    {viewing.images.map((image) => (
                                        <img
                                            key={image.id}
                                            src={image.url}
                                            alt={viewing.item_name}
                                            className="aspect-video w-full rounded-md object-cover"
                                        />
                                    ))}
                                </div>
                            )}
                            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                <Detail
                                    label="Serial no."
                                    value={viewing.serial_no}
                                />
                                <Detail
                                    label="Model no."
                                    value={viewing.model_no}
                                />
                                <Detail
                                    label="Acquisition date"
                                    value={formatDate(viewing.acquisition_date)}
                                />
                                <Detail
                                    label="Acquisition cost"
                                    value={
                                        viewing.acquisition_cost
                                            ? formatPeso(
                                                  viewing.acquisition_cost,
                                              )
                                            : null
                                    }
                                />
                                <Detail label="Fund" value={viewing.fund} />
                                <Detail
                                    label="Location"
                                    value={viewing.location?.location_name}
                                />
                                <Detail
                                    label="Condition"
                                    value={viewing.condition}
                                />
                                <Detail
                                    label="Quantity"
                                    value={`${viewing.quantity_per_physical_count} ${viewing.unit_of_measure ?? ''}`}
                                />
                                <Detail
                                    label="Description"
                                    value={viewing.item_description}
                                    className="sm:col-span-2"
                                />
                                <Detail
                                    label="Remarks"
                                    value={viewing.remarks}
                                    className="sm:col-span-2"
                                />
                            </dl>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

StaffProperties.layout = {
    breadcrumbs: [{ title: 'My properties', href: staffProperties() }],
};

function Detail({
    label,
    value,
    className,
}: {
    label: string;
    value: string | null | undefined;
    className?: string;
}) {
    return (
        <div className={className}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium whitespace-pre-line">{value || '—'}</dd>
        </div>
    );
}
