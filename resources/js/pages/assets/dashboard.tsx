import { Head, Link } from '@inertiajs/react';
import { Armchair, CheckCircle2, MapPin, Users } from 'lucide-react';
import { ChartCard } from '@/components/chart-card';
import { BarList, DonutChart } from '@/components/charts';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
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
import { useCan } from '@/hooks/use-can';
import { formatDate, formatNumber, toNumber } from '@/lib/format';
import { dashboard as assetsDashboard } from '@/routes/assets';
import { index as locationsIndex } from '@/routes/location';
import {
    create as createProperty,
    index as propertiesIndex,
    view,
} from '@/routes/property';
import type { Property } from '@/types';

type Breakdown = { label: string; total: number | string }[];

type Props = {
    totalUsers: number;
    lastUpdated: string | null;
    totalProperties: number;
    totalLocations: number;
    byCondition: Breakdown;
    byFund: Breakdown;
    byLocation: Breakdown;
    recentProperties: Property[];
};

export default function AssetsDashboard(props: Props) {
    const can = useCan();
    const serviceable = props.byCondition.find(
        (row) => row.label.toLowerCase() === 'serviceable',
    );

    return (
        <>
            <Head title="Assets dashboard" />
            <PageContainer>
                <PageHeader
                    title="Assets dashboard"
                    description="Overview of office properties and where they are"
                    actions={
                        can('properties.create') && (
                            <Button asChild>
                                <Link href={createProperty()}>
                                    Add property
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        title="Properties"
                        value={formatNumber(props.totalProperties)}
                        icon={Armchair}
                        href={propertiesIndex()}
                    />
                    <StatCard
                        title="Serviceable"
                        value={formatNumber(serviceable?.total ?? 0)}
                        icon={CheckCircle2}
                        description={
                            props.totalProperties > 0
                                ? `${Math.round((toNumber(serviceable?.total ?? 0) / props.totalProperties) * 100)}% of all properties`
                                : undefined
                        }
                    />
                    <StatCard
                        title="Locations"
                        value={formatNumber(props.totalLocations)}
                        icon={MapPin}
                        href={locationsIndex()}
                    />
                    <StatCard
                        title="Users"
                        value={formatNumber(props.totalUsers)}
                        icon={Users}
                        description={
                            props.lastUpdated
                                ? `Last updated ${props.lastUpdated}`
                                : undefined
                        }
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <ChartCard title="By condition">
                        {props.byCondition.length === 0 ? (
                            <NoData />
                        ) : (
                            <DonutChart
                                data={props.byCondition.map((row) => ({
                                    label: row.label,
                                    value: toNumber(row.total),
                                }))}
                                centerLabel="Properties"
                            />
                        )}
                    </ChartCard>
                    <ChartCard title="By fund">
                        {props.byFund.length === 0 ? (
                            <NoData />
                        ) : (
                            <DonutChart
                                data={props.byFund.map((row) => ({
                                    label: row.label,
                                    value: toNumber(row.total),
                                }))}
                                centerLabel="Properties"
                            />
                        )}
                    </ChartCard>
                    <ChartCard
                        title="Top locations"
                        description="Where most properties are kept"
                    >
                        {props.byLocation.length === 0 ? (
                            <NoData />
                        ) : (
                            <BarList
                                data={props.byLocation.map((row) => ({
                                    label: row.label,
                                    value: toNumber(row.total),
                                }))}
                            />
                        )}
                    </ChartCard>
                </div>

                <ChartCard
                    title="Recently updated"
                    actions={
                        <Button asChild variant="outline" size="sm">
                            <Link href={propertiesIndex()}>View all</Link>
                        </Button>
                    }
                >
                    {props.recentProperties.length === 0 ? (
                        <NoData />
                    ) : (
                        <TablePanel flush>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Property no.</TableHead>
                                        <TableHead>Item name</TableHead>
                                        <TableHead>Assigned to</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Condition</TableHead>
                                        <TableHead className="text-right">
                                            Updated
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {props.recentProperties.map((property) => (
                                        <TableRow key={property.id}>
                                            <TableCell className="font-mono">
                                                <Link
                                                    href={view(property.id)}
                                                    className="hover:underline"
                                                >
                                                    {property.property_number}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {property.item_name}
                                            </TableCell>
                                            <TableCell>
                                                {property.user?.name ?? 'TBD'}
                                            </TableCell>
                                            <TableCell>
                                                {property.location
                                                    ?.location_name ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <ConditionBadge
                                                    condition={
                                                        property.condition
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {formatDate(
                                                    property.updated_at,
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TablePanel>
                    )}
                </ChartCard>
            </PageContainer>
        </>
    );
}

function NoData() {
    return (
        <EmptyState
            icon={Armchair}
            title="No properties yet"
            className="py-8"
        />
    );
}

AssetsDashboard.layout = {
    breadcrumbs: [{ title: 'Assets dashboard', href: assetsDashboard() }],
};
