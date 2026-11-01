import { Head, Link } from '@inertiajs/react';
import { ArrowUpRight, LockKeyhole, PackageSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConditionBadge } from '@/components/status-badges';
import { Button } from '@/components/ui/button';
import { formatLongDate, formatPeso } from '@/lib/format';
import { signIn } from '@/routes/property/scan';

/** What a scanned sticker shows; the second half only to signed-in users. */
type PublicProperty = {
    item_name: string;
    property_number: string;
    serial_no: string | null;
    model_no: string | null;
    condition: string | null;
    location: string | null;
    accountable: {
        name: string;
        designation: string | null;
        division: string | null;
    } | null;
    item_description?: string | null;
    acquisition_date?: string | null;
    acquisition_cost?: string | null;
    fund?: string | null;
    unit_of_measure?: string | null;
    quantity?: number | null;
    remarks?: string | null;
    photos?: string[];
};

type Props = {
    propertyNumber: string;
    property: PublicProperty | null;
    signedIn: boolean;
    openUrl: string | null;
};

/**
 * The page a property sticker's QR code opens, on any phone. Everyone sees
 * what the item is, where it is and who is accountable; people signed in to
 * SINOP also see its cost, fund, notes and photos.
 */
export default function ScannedProperty({
    propertyNumber,
    property,
    signedIn,
    openUrl,
}: Props) {
    return (
        <>
            <Head
                title={
                    property
                        ? `${property.item_name} · ${property.property_number}`
                        : 'Property not found'
                }
            />
            <div className="min-h-svh bg-muted/40 px-4 py-6 text-foreground sm:py-10">
                <div className="mx-auto grid max-w-lg gap-5">
                    <header className="flex items-center gap-3">
                        <img
                            src="/img/ched-logo.png"
                            alt=""
                            className="size-10"
                        />
                        <div className="leading-tight">
                            <p className="text-sm font-semibold">
                                Commission on Higher Education
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Regional Office XII · Government property
                            </p>
                        </div>
                    </header>

                    {property ? (
                        <PropertyCard
                            property={property}
                            signedIn={signedIn}
                            openUrl={openUrl}
                        />
                    ) : (
                        <section className="grid justify-items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
                            <PackageSearch className="size-8 text-muted-foreground" />
                            <h1 className="font-semibold">
                                No property with number {propertyNumber}
                            </h1>
                            <p className="max-w-xs text-sm text-muted-foreground">
                                It may have been removed from the inventory, or
                                the sticker may be damaged. Please ask the
                                supply office.
                            </p>
                        </section>
                    )}

                    <p className="text-center text-xs text-muted-foreground">
                        SINOP · Supply and Property Management
                    </p>
                </div>
            </div>
        </>
    );
}

function PropertyCard({
    property,
    signedIn,
    openUrl,
}: {
    property: PublicProperty;
    signedIn: boolean;
    openUrl: string | null;
}) {
    const holder = property.accountable;
    const cost = property.acquisition_cost;

    return (
        <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {property.photos && property.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-px bg-border">
                    {property.photos.slice(0, 4).map((photo) => (
                        <img
                            key={photo}
                            src={photo}
                            alt=""
                            className="aspect-[4/3] w-full bg-muted object-cover"
                        />
                    ))}
                </div>
            )}

            <div className="grid gap-5 p-5">
                <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-3">
                        <h1 className="text-lg leading-snug font-semibold">
                            {property.item_name}
                        </h1>
                        <ConditionBadge condition={property.condition} />
                    </div>
                    <p className="font-mono text-base font-semibold tracking-wide">
                        {property.property_number}
                    </p>
                </div>

                <dl className="grid gap-3 text-sm">
                    <Detail label="Accountable person">
                        {holder ? (
                            <>
                                <span className="block font-medium">
                                    {holder.name}
                                </span>
                                <span className="block text-muted-foreground">
                                    {[holder.designation, holder.division]
                                        .filter(Boolean)
                                        .join(' · ') || '—'}
                                </span>
                            </>
                        ) : (
                            '—'
                        )}
                    </Detail>
                    <Detail label="Location">{property.location ?? '—'}</Detail>
                    <Detail label="Serial no.">
                        {property.serial_no || '—'}
                    </Detail>
                    <Detail label="Model no.">
                        {property.model_no || '—'}
                    </Detail>
                </dl>

                {signedIn ? (
                    <dl className="grid gap-3 border-t pt-4 text-sm">
                        <Detail label="Acquired">
                            {property.acquisition_date
                                ? formatLongDate(property.acquisition_date)
                                : '—'}
                        </Detail>
                        <Detail label="Acquisition cost">
                            {cost ? formatPeso(cost) : '—'}
                        </Detail>
                        <Detail label="Fund">{property.fund || '—'}</Detail>
                        <Detail label="Quantity">
                            {[property.quantity, property.unit_of_measure]
                                .filter(Boolean)
                                .join(' ') || '—'}
                        </Detail>
                        {property.item_description && (
                            <Detail label="Description">
                                {property.item_description}
                            </Detail>
                        )}
                        {property.remarks && (
                            <Detail label="Remarks">{property.remarks}</Detail>
                        )}
                    </dl>
                ) : (
                    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                            <LockKeyhole className="size-4 shrink-0" />
                            Cost, notes and photos are for SINOP users.
                        </span>
                        <Button asChild size="sm" variant="outline">
                            <Link href={signIn.url(property.property_number)}>
                                Sign in
                            </Link>
                        </Button>
                    </div>
                )}

                {openUrl && (
                    <Button asChild>
                        <Link href={openUrl}>
                            Open in SINOP
                            <ArrowUpRight />
                        </Link>
                    </Button>
                )}
            </div>
        </article>
    );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{children}</dd>
        </div>
    );
}
