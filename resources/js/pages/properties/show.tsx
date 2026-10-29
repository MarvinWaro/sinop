import { Head, Link } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    ImageOff,
    Maximize2,
    Package,
    Pencil,
    Printer,
} from 'lucide-react';
import { useState } from 'react';
import { PageContainer, PageHeader } from '@/components/page-header';
import { ConditionBadge } from '@/components/status-badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useCan } from '@/hooks/use-can';
import {
    formatLongDate,
    formatPeso,
    initialsOf,
    parseDate,
    shortMonthNames,
    truncate,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    downloadQr,
    edit,
    index as propertiesIndex,
    view,
} from '@/routes/property';
import type { Property } from '@/types';

type OtherProperty = {
    id: number;
    property_number: string;
    item_name: string;
    item_description: string | null;
    acquisition_date: string | null;
    image_url: string | null;
};

type Props = {
    property: Property;
    qrCodeImage: string;
    holder: { assignedCount: number; lastAssignment: string | null };
    otherProperties: OtherProperty[];
};

export default function PropertyShow({
    property,
    qrCodeImage,
    holder,
    otherProperties,
}: Props) {
    const can = useCan();
    const [qrOpen, setQrOpen] = useState(false);
    const user = property.user ?? null;

    return (
        <>
            <Head title={property.item_name} />
            <PageContainer>
                <PageHeader
                    title={property.item_name}
                    description={`Property no. ${property.property_number}`}
                    actions={
                        can('properties.update') && (
                            <Button asChild variant="outline">
                                <Link href={edit(property.id)}>
                                    <Pencil />
                                    Edit
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardContent>
                            <ImageCarousel
                                images={(property.images ?? []).map(
                                    (image) => image.url,
                                )}
                                alt={property.item_name}
                            />
                        </CardContent>
                    </Card>

                    <div className="grid gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>QR code</CardTitle>
                                <CardDescription>
                                    Scan to see the property details
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center gap-4">
                                <img
                                    src={qrCodeImage}
                                    alt={`QR code for ${property.property_number}`}
                                    className="size-40 rounded-md border bg-white p-2"
                                />
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setQrOpen(true)}
                                    >
                                        <Maximize2 />
                                        Enlarge QR
                                    </Button>
                                    {can('properties.qr') && (
                                        <Button asChild size="sm">
                                            <a
                                                href={downloadQr.url(
                                                    property.id,
                                                )}
                                            >
                                                <Printer />
                                                Print sticker
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Accountable officer</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-12">
                                        {user?.avatar && (
                                            <AvatarImage
                                                src={user.avatar}
                                                alt={user.name}
                                            />
                                        )}
                                        <AvatarFallback>
                                            {initialsOf(user?.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">
                                            {user?.name ?? 'No assigned user'}
                                        </p>
                                        {user && (
                                            <p className="text-sm text-muted-foreground">
                                                {[
                                                    user.designation?.name,
                                                    user.department?.name,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ') || '—'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {user && (
                                    <dl className="grid gap-2 rounded-md border p-3 text-sm">
                                        <div className="flex justify-between gap-3">
                                            <dt className="text-muted-foreground">
                                                Assigned properties
                                            </dt>
                                            <dd className="font-medium tabular-nums">
                                                {holder.assignedCount}
                                            </dd>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <dt className="text-muted-foreground">
                                                Last assignment
                                            </dt>
                                            <dd className="truncate text-right font-medium">
                                                {holder.lastAssignment ?? 'N/A'}
                                            </dd>
                                        </div>
                                    </dl>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <DetailCard title="Basic information">
                        <Detail label="Item name" value={property.item_name} />
                        <Detail
                            label="Property number"
                            value={property.property_number}
                        />
                        <Detail
                            label="Serial number"
                            value={property.serial_no ?? 'N/A'}
                        />
                        <Detail
                            label="Model number"
                            value={property.model_no ?? 'N/A'}
                        />
                    </DetailCard>
                    <DetailCard title="Financial details">
                        <Detail
                            label="Acquisition date"
                            value={formatLongDate(
                                property.acquisition_date,
                                'N/A',
                            )}
                        />
                        <Detail
                            label="Acquisition cost"
                            value={
                                property.acquisition_cost
                                    ? formatPeso(property.acquisition_cost)
                                    : 'N/A'
                            }
                        />
                        <Detail label="Fund" value={property.fund ?? 'N/A'} />
                        <Detail
                            label="Condition"
                            value={
                                <ConditionBadge
                                    condition={property.condition}
                                />
                            }
                        />
                    </DetailCard>
                    <DetailCard title="Location & details">
                        <Detail
                            label="Location"
                            value={property.location?.location_name ?? 'N/A'}
                        />
                        <Detail
                            label="Quantity (physical count)"
                            value={property.quantity_per_physical_count}
                        />
                        <Detail
                            label="Description"
                            value={
                                property.item_description ||
                                'No description available.'
                            }
                        />
                        <Detail
                            label="Remarks"
                            value={property.remarks || 'No remarks.'}
                        />
                    </DetailCard>
                </div>

                {user && otherProperties.length > 0 && (
                    <section className="grid gap-4">
                        <h2 className="text-lg font-semibold">
                            Other properties held by {user.name}
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {otherProperties.map((other) => (
                                <Link
                                    key={other.id}
                                    href={view(other.id)}
                                    className="group overflow-hidden rounded-xl border bg-card transition-colors hover:bg-muted/50"
                                >
                                    <div className="flex aspect-video items-center justify-center bg-muted">
                                        {other.image_url ? (
                                            <img
                                                src={other.image_url}
                                                alt=""
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            <Package className="size-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="grid gap-1 p-4">
                                        <Badge
                                            variant="secondary"
                                            className="w-fit font-mono"
                                        >
                                            {other.property_number}
                                        </Badge>
                                        <p className="font-medium">
                                            {other.item_name}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {truncate(
                                                other.item_description ??
                                                    'No description',
                                                60,
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {monthYear(other.acquisition_date)}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </PageContainer>

            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{property.item_name}</DialogTitle>
                        <DialogDescription>
                            Property no. {property.property_number}
                        </DialogDescription>
                    </DialogHeader>
                    <img
                        src={qrCodeImage}
                        alt={`QR code for ${property.property_number}`}
                        className="mx-auto w-full max-w-80 rounded-md border bg-white p-3"
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

function monthYear(value: string | null): string {
    const date = parseDate(value);

    return date
        ? `${shortMonthNames[date.getMonth()]} ${date.getFullYear()}`
        : 'Unknown date';
}

function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
    const [index, setIndex] = useState(0);

    if (images.length === 0) {
        return (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg bg-muted text-sm text-muted-foreground">
                <ImageOff className="size-8" />
                No photos uploaded
            </div>
        );
    }

    const current = Math.min(index, images.length - 1);
    const go = (step: number) =>
        setIndex((current + step + images.length) % images.length);

    return (
        <div className="grid gap-3">
            <div className="relative overflow-hidden rounded-lg bg-muted">
                <img
                    src={images[current]}
                    alt={`${alt} – photo ${current + 1}`}
                    className="aspect-video w-full object-contain"
                />
                {images.length > 1 && (
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full"
                            onClick={() => go(-1)}
                            aria-label="Previous photo"
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
                            onClick={() => go(1)}
                            aria-label="Next photo"
                        >
                            <ChevronRight />
                        </Button>
                    </>
                )}
            </div>
            {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                    {images.map((src, i) => (
                        <button
                            key={src}
                            type="button"
                            onClick={() => setIndex(i)}
                            className={cn(
                                'overflow-hidden rounded-md border-2',
                                i === current
                                    ? 'border-primary'
                                    : 'border-transparent opacity-70 hover:opacity-100',
                            )}
                            aria-label={`Show photo ${i + 1}`}
                            aria-current={i === current}
                        >
                            <img
                                src={src}
                                alt=""
                                className="aspect-square w-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function DetailCard({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="grid gap-3">{children}</dl>
            </CardContent>
        </Card>
    );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium break-words">{value}</dd>
        </div>
    );
}

PropertyShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Properties', href: propertiesIndex() },
        { title: props.property.item_name, href: view(props.property.id) },
    ],
});
