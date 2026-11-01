import { Head, Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUpRight,
    Armchair,
    MapPin,
    Package,
    Plus,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BarList, ShareBar } from '@/components/charts';
import type { ShareSegment } from '@/components/charts';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
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
import { useCan } from '@/hooks/use-can';
import {
    formatNumber,
    formatRelative,
    initialsOf,
    toNumber,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { dashboard as assetsDashboard } from '@/routes/assets';
import { index as locationsIndex } from '@/routes/location';
import {
    create as createProperty,
    index as propertiesIndex,
    view,
} from '@/routes/property';

type Breakdown = { label: string; total: number | string }[];

type RecentProperty = {
    id: number;
    property_number: string;
    item_name: string;
    condition: string | null;
    holder: string | null;
    holder_avatar: string | null;
    location: string | null;
    image_url: string | null;
    updated_at: string | null;
};

type Props = {
    totalProperties: number;
    totalLocations: number;
    totalHolders: number;
    byCondition: Breakdown;
    byFund: Breakdown;
    byLocation: Breakdown;
    recentProperties: RecentProperty[];
};

const UNSPECIFIED = 'Unspecified';
const NEUTRAL = 'var(--color-zinc-400)';

// A condition keeps its colour whatever its rank: green is fine, red needs
// replacing, amber is anything else an admin added.
const conditionColors: Record<string, string> = {
    serviceable: 'var(--color-emerald-500)',
    unserviceable: 'var(--color-red-500)',
};

function conditionSegments(rows: Breakdown): ShareSegment[] {
    return rows.map((row) => ({
        label: row.label,
        value: toNumber(row.total),
        color:
            row.label === UNSPECIFIED
                ? NEUTRAL
                : (conditionColors[row.label.toLowerCase()] ??
                  'var(--color-amber-500)'),
    }));
}

// Funds are shades of one colour, so they can't be mistaken for the
// condition colours above. They take them in name order, so a fund keeps
// its shade when another one overtakes it.
const fundShades = [100, 60, 35, 20];

function fundSegments(rows: Breakdown): ShareSegment[] {
    const names = rows
        .map((row) => row.label)
        .filter((label) => label !== UNSPECIFIED)
        .sort((a, b) => a.localeCompare(b));

    return rows.map((row) => {
        const shade = fundShades[names.indexOf(row.label) % fundShades.length];

        return {
            label: row.label,
            value: toNumber(row.total),
            color:
                row.label === UNSPECIFIED
                    ? NEUTRAL
                    : `color-mix(in oklab, var(--chart-1) ${shade}%, var(--card))`,
        };
    });
}

export default function AssetsDashboard(props: Props) {
    const can = useCan();
    const total = props.totalProperties;
    const serviceable = toNumber(
        props.byCondition.find(
            (row) => row.label.toLowerCase() === 'serviceable',
        )?.total ?? 0,
    );
    const serviceableShare = total > 0 ? (serviceable / total) * 100 : 0;
    const busiest = props.byLocation[0]?.label;

    return (
        <>
            <Head title="Assets overview" />
            <PageContainer>
                <PageHeader
                    title="Assets overview"
                    description="Office properties at a glance: their condition, fund and where they are kept."
                    actions={
                        <>
                            {can('properties.view') && (
                                <Button asChild variant="outline">
                                    <Link href={propertiesIndex()}>
                                        All properties
                                    </Link>
                                </Button>
                            )}
                            {can('properties.create') && (
                                <Button asChild>
                                    <Link href={createProperty()}>
                                        <Plus />
                                        Add property
                                    </Link>
                                </Button>
                            )}
                        </>
                    }
                />

                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border shadow-xs lg:grid-cols-4">
                    <Metric
                        label="Properties"
                        icon={Armchair}
                        value={formatNumber(total)}
                        hint="Removed items are not counted"
                        href={
                            can('properties.view')
                                ? propertiesIndex()
                                : undefined
                        }
                    />
                    <Metric
                        label="Serviceable"
                        icon={ShieldCheck}
                        value={`${Math.round(serviceableShare)}%`}
                        hint={`${formatNumber(serviceable)} of ${formatNumber(total)} in working order`}
                    >
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${serviceableShare}%` }}
                            />
                        </div>
                    </Metric>
                    <Metric
                        label="Accountable officers"
                        icon={UserRound}
                        value={formatNumber(props.totalHolders)}
                        hint="People with property assigned to them"
                    />
                    <Metric
                        label="Locations"
                        icon={MapPin}
                        value={formatNumber(props.totalLocations)}
                        hint={busiest ? `Most kept in ${busiest}` : 'None yet'}
                        href={
                            can('locations.view') ? locationsIndex() : undefined
                        }
                    />
                </div>

                {total === 0 ? (
                    <Card>
                        <EmptyState
                            icon={Armchair}
                            title="No properties yet"
                            description="Add the office's equipment and furniture to see their condition, fund and location here."
                            action={
                                can('properties.create') && (
                                    <Button asChild>
                                        <Link href={createProperty()}>
                                            <Plus />
                                            Add property
                                        </Link>
                                    </Button>
                                )
                            }
                        />
                    </Card>
                ) : (
                    <div className="grid items-start gap-6 lg:grid-cols-3">
                        <Card className="gap-0 pb-2 lg:col-span-2">
                            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
                                <div className="space-y-1.5">
                                    <CardTitle>Recently updated</CardTitle>
                                    <CardDescription>
                                        The last properties added or changed
                                    </CardDescription>
                                </div>
                                {can('properties.view') && (
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className="-mr-2 text-muted-foreground"
                                    >
                                        <Link href={propertiesIndex()}>
                                            View all
                                            <ArrowRight />
                                        </Link>
                                    </Button>
                                )}
                            </CardHeader>
                            <ul className="divide-y border-t">
                                {props.recentProperties.map((property) => (
                                    <li key={property.id}>
                                        <RecentRow property={property} />
                                    </li>
                                ))}
                            </ul>
                        </Card>

                        <div className="grid gap-6">
                            <Card className="gap-5">
                                <CardHeader>
                                    <CardTitle>Breakdown</CardTitle>
                                    <CardDescription>
                                        By condition and by fund
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="grid gap-6">
                                    <Section title="Condition">
                                        <ShareBar
                                            data={conditionSegments(
                                                props.byCondition,
                                            )}
                                        />
                                    </Section>
                                    <Section title="Fund">
                                        <ShareBar
                                            data={fundSegments(props.byFund)}
                                        />
                                    </Section>
                                </CardContent>
                            </Card>

                            <Card className="gap-5">
                                <CardHeader>
                                    <CardTitle>Top locations</CardTitle>
                                    <CardDescription>
                                        Where most properties are kept
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {props.byLocation.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No property has a location yet.
                                        </p>
                                    ) : (
                                        <BarList
                                            color="var(--chart-1)"
                                            data={props.byLocation.map(
                                                (row) => ({
                                                    label: row.label,
                                                    value: toNumber(row.total),
                                                }),
                                            )}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </PageContainer>
        </>
    );
}

/** One figure in the strip at the top; a link when it has a page. */
function Metric({
    label,
    icon: Icon,
    value,
    hint,
    href,
    children,
}: {
    label: string;
    icon: LucideIcon;
    value: string;
    hint: string;
    href?: NonNullable<InertiaLinkProps['href']>;
    children?: ReactNode;
}) {
    const body = (
        <>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4" />
                {label}
                {href && (
                    <ArrowUpRight className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                )}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
                {value}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
                {hint}
            </p>
            {children}
        </>
    );

    return href ? (
        <Link
            href={href}
            className="group block min-w-0 bg-card p-4 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 sm:p-5"
        >
            {body}
        </Link>
    ) : (
        <div className="min-w-0 bg-card p-4 sm:p-5">{body}</div>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="grid gap-3">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {title}
            </h3>
            {children}
        </section>
    );
}

function RecentRow({ property }: { property: RecentProperty }) {
    return (
        <Link
            href={view(property.id)}
            className="flex items-center gap-4 px-6 py-3 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40"
        >
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground">
                {property.image_url ? (
                    <img
                        src={property.image_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                    />
                ) : (
                    <Package className="size-5" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{property.item_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">
                        {property.property_number}
                    </span>
                    {property.location && ` · ${property.location}`}
                </p>
            </div>
            <div className="hidden w-44 min-w-0 items-center gap-2 md:flex">
                <Avatar className="size-6">
                    {property.holder_avatar && (
                        <AvatarImage
                            src={property.holder_avatar}
                            alt={property.holder ?? ''}
                        />
                    )}
                    <AvatarFallback className="text-[10px]">
                        {initialsOf(property.holder)}
                    </AvatarFallback>
                </Avatar>
                <span
                    className={cn(
                        'truncate text-sm',
                        !property.holder && 'text-muted-foreground',
                    )}
                >
                    {property.holder ?? 'Not assigned'}
                </span>
            </div>
            <div className="hidden w-28 shrink-0 sm:block">
                <ConditionBadge condition={property.condition} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {formatRelative(property.updated_at)}
            </span>
        </Link>
    );
}

AssetsDashboard.layout = {
    breadcrumbs: [{ title: 'Assets overview', href: assetsDashboard() }],
};
