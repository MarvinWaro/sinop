import { Head, Link } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    FileDown,
    ImageOff,
    MapPin,
    Maximize2,
    Package,
    Pencil,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PageContainer, PageHeader } from '@/components/page-header';
import {
    PropertySticker,
    PropertyStickerCard,
    scanLink,
} from '@/components/properties/property-sticker';
import { ConditionBadge } from '@/components/status-badges';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    formatNumber,
    formatPeso,
    initialsOf,
    parseDate,
    shortMonthNames,
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
    holder: { assignedCount: number; lastAssignment: string | null };
    otherProperties: OtherProperty[];
};

export default function PropertyShow({
    property,
    holder,
    otherProperties,
}: Props) {
    const can = useCan();
    const [qrOpen, setQrOpen] = useState(false);
    const user = property.user ?? null;
    const quantity = [
        formatNumber(property.quantity_per_physical_count),
        property.unit_of_measure,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <>
            <Head title={property.item_name} />
            <PageContainer>
                <PageHeader
                    title={property.item_name}
                    description={
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                            <span className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs text-foreground">
                                {property.property_number}
                            </span>
                            <ConditionBadge condition={property.condition} />
                            {property.fund && (
                                <Meta icon={Wallet}>{property.fund}</Meta>
                            )}
                            {property.location && (
                                <Meta icon={MapPin}>
                                    {property.location.location_name}
                                </Meta>
                            )}
                        </span>
                    }
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

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="grid gap-6">
                        <Gallery
                            images={(property.images ?? []).map(
                                (image) => image.url,
                            )}
                            alt={property.item_name}
                            addHref={
                                can('properties.update')
                                    ? edit.url(property.id)
                                    : undefined
                            }
                        />

                        <Card>
                            <CardHeader>
                                <CardTitle>Details</CardTitle>
                            </CardHeader>
                            <CardContent className="grid gap-6">
                                <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
                                    <Field label="Property number" mono>
                                        {property.property_number}
                                    </Field>
                                    <Field label="Serial number" mono>
                                        {property.serial_no}
                                    </Field>
                                    <Field label="Model number" mono>
                                        {property.model_no}
                                    </Field>
                                    <Field label="Acquired">
                                        {formatLongDate(
                                            property.acquisition_date,
                                            '',
                                        )}
                                    </Field>
                                    <Field label="Acquisition cost">
                                        {property.acquisition_cost
                                            ? formatPeso(
                                                  property.acquisition_cost,
                                              )
                                            : null}
                                    </Field>
                                    <Field label="Fund">{property.fund}</Field>
                                    <Field label="Location">
                                        {property.location?.location_name}
                                    </Field>
                                    <Field label="Quantity (physical count)">
                                        {quantity}
                                    </Field>
                                    <Field label="Condition">
                                        <ConditionBadge
                                            condition={property.condition}
                                        />
                                    </Field>
                                </dl>
                                <dl className="grid gap-5 border-t pt-6 sm:grid-cols-2">
                                    <Field label="Description" prose>
                                        {property.item_description}
                                    </Field>
                                    <Field label="Remarks" prose>
                                        {property.remarks}
                                    </Field>
                                </dl>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6">
                        <Card className="gap-4">
                            <CardHeader>
                                <CardDescription className="text-xs font-medium tracking-wide uppercase">
                                    Accountable officer
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4">
                                {user ? (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="size-11">
                                                {user.avatar && (
                                                    <AvatarImage
                                                        src={user.avatar}
                                                        alt={user.name}
                                                    />
                                                )}
                                                <AvatarFallback>
                                                    {initialsOf(user.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold">
                                                    {user.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {[
                                                        user.designation?.name,
                                                        user.department?.name,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ') || '—'}
                                                </p>
                                            </div>
                                        </div>
                                        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm">
                                            <div className="bg-card px-3 py-2.5">
                                                <dt className="text-xs text-muted-foreground">
                                                    Holds
                                                </dt>
                                                <dd className="font-medium tabular-nums">
                                                    {holder.assignedCount}{' '}
                                                    {holder.assignedCount === 1
                                                        ? 'property'
                                                        : 'properties'}
                                                </dd>
                                            </div>
                                            <div className="min-w-0 bg-card px-3 py-2.5">
                                                <dt className="text-xs text-muted-foreground">
                                                    Latest
                                                </dt>
                                                <dd
                                                    className="truncate font-medium"
                                                    title={
                                                        holder.lastAssignment ??
                                                        undefined
                                                    }
                                                >
                                                    {holder.lastAssignment ??
                                                        '—'}
                                                </dd>
                                            </div>
                                        </dl>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Not assigned to anyone yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <PropertyStickerCard
                            itemName={property.item_name}
                            propertyNumber={property.property_number}
                            serialNo={property.serial_no}
                            actions={
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="size-8"
                                        onClick={() => setQrOpen(true)}
                                        aria-label="Enlarge sticker"
                                        title="Enlarge"
                                    >
                                        <Maximize2 />
                                    </Button>
                                    {can('properties.qr') && (
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="icon"
                                            className="size-8"
                                        >
                                            <a
                                                href={downloadQr.url(
                                                    property.id,
                                                )}
                                                aria-label="Download the QR code as a PDF"
                                                title="QR code PDF"
                                            >
                                                <FileDown />
                                            </a>
                                        </Button>
                                    )}
                                </>
                            }
                        />
                    </div>
                </div>

                {user && otherProperties.length > 0 && (
                    <section className="grid gap-4">
                        <div className="flex items-baseline justify-between gap-4">
                            <h2 className="font-semibold">
                                Also held by {user.name}
                            </h2>
                            <span className="text-sm text-muted-foreground tabular-nums">
                                {otherProperties.length}
                            </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {otherProperties.map((other) => (
                                <Link
                                    key={other.id}
                                    href={view(other.id)}
                                    className="group overflow-hidden rounded-xl border bg-card transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    <div className="flex aspect-[16/10] items-center justify-center overflow-hidden bg-muted">
                                        {other.image_url ? (
                                            <img
                                                src={other.image_url}
                                                alt=""
                                                loading="lazy"
                                                className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                            />
                                        ) : (
                                            <Package className="size-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="grid gap-0.5 p-4">
                                        <p className="truncate font-medium">
                                            {other.item_name}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            <span className="font-mono">
                                                {other.property_number}
                                            </span>
                                            {' · '}
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
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{property.item_name}</DialogTitle>
                        <DialogDescription>
                            Property no. {property.property_number}
                        </DialogDescription>
                    </DialogHeader>
                    <PropertySticker
                        itemName={property.item_name}
                        propertyNumber={property.property_number}
                        serialNo={property.serial_no}
                        scanUrl={scanLink(property.property_number)}
                        className="rounded-md border"
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

function Meta({
    icon: Icon,
    children,
}: {
    icon: typeof MapPin;
    children: ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" />
            {children}
        </span>
    );
}

/** One labelled value; an empty one shows a dash. */
function Field({
    label,
    mono = false,
    prose = false,
    children,
}: {
    label: string;
    mono?: boolean;
    /** Longer text (description, remarks): normal weight, keeps line breaks. */
    prose?: boolean;
    children: ReactNode;
}) {
    const empty =
        children === null ||
        children === undefined ||
        (typeof children === 'string' && children.trim() === '');

    return (
        <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    'mt-1 text-sm break-words',
                    prose ? 'whitespace-pre-line' : 'font-medium',
                    mono && !empty && 'font-mono',
                    empty && 'font-normal text-muted-foreground',
                )}
            >
                {empty ? '—' : children}
            </dd>
        </div>
    );
}

/**
 * The photos: the current one large (on a blurred copy of itself, so
 * portrait and odd sizes don't leave grey bars), thumbnails below.
 */
function Gallery({
    images,
    alt,
    addHref,
}: {
    images: string[];
    alt: string;
    /** Where to add photos when there are none (the edit page). */
    addHref?: string;
}) {
    const [index, setIndex] = useState(0);

    if (images.length === 0) {
        return (
            <Card className="py-0">
                <div className="flex h-72 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                    <div className="rounded-full border bg-muted/50 p-3">
                        <ImageOff className="size-6" />
                    </div>
                    No photos yet
                    {addHref && (
                        <Button asChild variant="outline" size="sm">
                            <Link href={addHref}>Add photos</Link>
                        </Button>
                    )}
                </div>
            </Card>
        );
    }

    const current = Math.min(index, images.length - 1);
    const many = images.length > 1;
    const go = (step: number) =>
        setIndex((current + step + images.length) % images.length);

    return (
        <Card className="gap-0 overflow-hidden py-0">
            <div
                className="group relative aspect-[16/10] overflow-hidden bg-muted"
                onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') {
                        go(-1);
                    } else if (event.key === 'ArrowRight') {
                        go(1);
                    }
                }}
            >
                <img
                    src={images[current]}
                    alt=""
                    aria-hidden
                    className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
                />
                <img
                    src={images[current]}
                    alt={`${alt}, photo ${current + 1} of ${images.length}`}
                    className="relative size-full object-contain"
                />
                {many && (
                    <>
                        <GalleryButton
                            side="left"
                            label="Previous photo"
                            onClick={() => go(-1)}
                        >
                            <ChevronLeft />
                        </GalleryButton>
                        <GalleryButton
                            side="right"
                            label="Next photo"
                            onClick={() => go(1)}
                        >
                            <ChevronRight />
                        </GalleryButton>
                        <span className="absolute right-3 bottom-3 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium tabular-nums shadow-sm backdrop-blur">
                            {current + 1} / {images.length}
                        </span>
                    </>
                )}
            </div>
            {many && (
                <div className="flex gap-2 overflow-x-auto border-t p-3">
                    {images.map((src, i) => (
                        <button
                            key={src}
                            type="button"
                            onClick={() => setIndex(i)}
                            className={cn(
                                'size-16 shrink-0 overflow-hidden rounded-md ring-offset-2 ring-offset-card transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                i === current
                                    ? 'ring-2 ring-primary'
                                    : 'opacity-60 hover:opacity-100',
                            )}
                            aria-label={`Show photo ${i + 1}`}
                            aria-current={i === current}
                        >
                            <img
                                src={src}
                                alt=""
                                className="size-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </Card>
    );
}

function GalleryButton({
    side,
    label,
    onClick,
    children,
}: {
    side: 'left' | 'right';
    label: string;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onClick}
            aria-label={label}
            className={cn(
                'absolute top-1/2 size-9 -translate-y-1/2 rounded-full bg-background/80 shadow-sm backdrop-blur transition-opacity hover:bg-background focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100',
                side === 'left' ? 'left-3' : 'right-3',
            )}
        >
            {children}
        </Button>
    );
}

PropertyShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Properties', href: propertiesIndex() },
        { title: props.property.item_name, href: view(props.property.id) },
    ],
});
