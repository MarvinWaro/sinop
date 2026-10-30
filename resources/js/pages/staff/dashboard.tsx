import { Head, Link, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    BadgeCheck,
    CircleCheck,
    Hourglass,
    PackageCheck,
    PackageOpen,
    Plus,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { ChartCard } from '@/components/chart-card';
import { BarChart, BarList } from '@/components/charts';
import { EmptyState } from '@/components/empty-state';
import { PageContainer, PageHeader } from '@/components/page-header';
import { UserModeNotice } from '@/components/staff/user-mode-notice';
import { StatCard } from '@/components/stat-card';
import { RisStatusBadge } from '@/components/status-badges';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/use-can';
import { useLiveProps } from '@/hooks/use-inbox';
import { formatDate, formatNumber } from '@/lib/format';
import { risKey } from '@/lib/ris';
import { userDashboard } from '@/routes/admin';
import { show as showRis } from '@/routes/ris';
import {
    dashboard as staffDashboard,
    received as staffReceived,
    requests as staffRequests,
} from '@/routes/staff';
import { forceChangePassword as forceChangePasswordRoute } from '@/routes/user';
import type { RisStatus } from '@/types';
import type { RequestCounts } from './requests';

type DivisionAnalytics = {
    requests: number;
    /** Pending or approved, not yet issued. */
    open: number;
    issued: number;
    requesters: number;
    itemsIssued: number;
    /** Quantity issued per month, January first. */
    monthly: number[];
    topSupplies: { name: string; unit: string | null; quantity: number }[];
};

type RecentItem = {
    id: number;
    name: string;
    stock_no: string | null;
    unit: string | null;
    requested: number;
    issued: number | null;
    ris: {
        route_key: string | null;
        ris_no: string | null;
        ris_date: string | null;
        status: RisStatus;
        received_at: string | null;
    };
};

type Props = {
    isAdminUserMode: boolean;
    forceChangePassword: boolean;
    year: number;
    counts: RequestCounts;
    department: { id: number; name: string } | null;
    analytics: DivisionAnalytics | null;
    recentItems: RecentItem[];
};

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

/** "Good morning" … by the hour in the Philippines. */
function greeting(): string {
    const hour = Number(
        new Intl.DateTimeFormat('en-PH', {
            hour: 'numeric',
            hourCycle: 'h23',
            timeZone: 'Asia/Manila',
        }).format(new Date()),
    );

    return hour < 12
        ? 'Good morning'
        : hour < 18
          ? 'Good afternoon'
          : 'Good evening';
}

export default function StaffDashboard({
    forceChangePassword,
    year,
    counts,
    department,
    analytics,
    recentItems,
}: Props) {
    const can = useCan();
    const { auth } = usePage().props;
    const [passwordPrompt, setPasswordPrompt] = useState(forceChangePassword);
    const firstName = auth.user.name.split(' ')[0];

    // Approvals and issues show here without a refresh.
    useLiveProps(['counts', 'analytics', 'recentItems']);

    const requestsWith = (status: string) =>
        staffRequests({ query: { status } });

    return (
        <>
            <Head title="Dashboard" />
            <PageContainer>
                <UserModeNotice />
                <PageHeader
                    title={`${greeting()}, ${firstName}`}
                    description={
                        department
                            ? `${department.name} · your requests and your division's supplies`
                            : 'Your requests at a glance'
                    }
                    actions={
                        can('ris.request') && (
                            <Button asChild>
                                <Link
                                    href={staffRequests({ query: { new: 1 } })}
                                >
                                    <Plus />
                                    Request supply
                                </Link>
                            </Button>
                        )
                    }
                />

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="Pending approval"
                        value={formatNumber(counts.draft)}
                        icon={Hourglass}
                        description="Waiting for the CAO"
                        href={requestsWith('draft')}
                    />
                    <StatCard
                        title="Approved"
                        value={formatNumber(counts.approved)}
                        icon={BadgeCheck}
                        description="To be issued by supply"
                        href={requestsWith('approved')}
                    />
                    <StatCard
                        title="To receive"
                        value={formatNumber(counts.toReceive)}
                        icon={PackageCheck}
                        description="Confirm once you have them"
                        href={staffReceived()}
                    />
                    <StatCard
                        title="Completed"
                        value={formatNumber(counts.completed)}
                        icon={CircleCheck}
                        description={`${formatNumber(counts.total)} requests in all`}
                        href={requestsWith('completed')}
                    />
                </div>

                {department && analytics ? (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <ChartCard
                            className="lg:col-span-2"
                            title="Supplies issued to your division"
                            description={`${department.name} · quantity issued each month, ${year}`}
                        >
                            <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                                <Figure label="Requests">
                                    {analytics.requests}
                                </Figure>
                                <Figure label="Waiting">
                                    {analytics.open}
                                </Figure>
                                <Figure label="Items issued">
                                    {analytics.itemsIssued}
                                </Figure>
                                <Figure label="People requesting">
                                    {analytics.requesters}
                                </Figure>
                            </dl>
                            <BarChart
                                labels={MONTHS}
                                series={[
                                    {
                                        name: 'Quantity issued',
                                        values: analytics.monthly,
                                    },
                                ]}
                                height={220}
                            />
                        </ChartCard>

                        <ChartCard
                            title="Most issued supplies"
                            description={`To your division in ${year}`}
                        >
                            {analytics.topSupplies.length > 0 ? (
                                <BarList
                                    data={analytics.topSupplies.map(
                                        (supply) => ({
                                            label: supply.name,
                                            value: supply.quantity,
                                            hint: supply.unit ?? undefined,
                                        }),
                                    )}
                                />
                            ) : (
                                <EmptyState
                                    className="border-0 py-8"
                                    icon={PackageOpen}
                                    title="Nothing issued yet"
                                    description={`No supplies were issued to your division in ${year}.`}
                                />
                            )}
                        </ChartCard>
                    </div>
                ) : (
                    <EmptyState
                        title="No division on your account"
                        description="Your division's analytics appear here once the administrator sets your division."
                    />
                )}

                <ChartCard
                    title="Supplies you requested recently"
                    description="Your latest requested items and where each request is"
                    actions={
                        <Button asChild variant="ghost" size="sm">
                            <Link href={staffRequests()}>
                                View all
                                <ArrowRight />
                            </Link>
                        </Button>
                    }
                >
                    {recentItems.length === 0 ? (
                        <EmptyState
                            className="border-0 py-8"
                            title="No requests yet"
                            description='Use "Request supply" to ask for office supplies.'
                        />
                    ) : (
                        <TablePanel flush>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Supply</TableHead>
                                        <TableHead className="text-right">
                                            Requested
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Issued
                                        </TableHead>
                                        <TableHead>RIS</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentItems.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="whitespace-normal">
                                                <p className="font-medium">
                                                    {item.name}
                                                </p>
                                                {item.stock_no && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Stock no.{' '}
                                                        {item.stock_no}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatNumber(item.requested)}{' '}
                                                <span className="text-muted-foreground">
                                                    {item.unit}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.issued === null
                                                    ? '—'
                                                    : formatNumber(item.issued)}
                                            </TableCell>
                                            <TableCell>
                                                {item.ris.route_key ? (
                                                    <Link
                                                        href={showRis(
                                                            risKey({
                                                                route_key:
                                                                    item.ris
                                                                        .route_key,
                                                            }),
                                                        )}
                                                        className="font-medium hover:underline"
                                                    >
                                                        {item.ris.ris_no}
                                                    </Link>
                                                ) : (
                                                    item.ris.ris_no
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(
                                                        item.ris.ris_date,
                                                    )}
                                                </p>
                                            </TableCell>
                                            <TableCell>
                                                <RisStatusBadge
                                                    slip={item.ris}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TablePanel>
                    )}
                </ChartCard>
            </PageContainer>

            <Dialog open={passwordPrompt} onOpenChange={setPasswordPrompt}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change your password</DialogTitle>
                        <DialogDescription>
                            You are still using the default password (12345678).
                            Please change it now.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPasswordPrompt(false)}
                        >
                            Later
                        </Button>
                        <Button asChild>
                            <Link href={forceChangePasswordRoute()}>
                                Change password
                            </Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

StaffDashboard.layout = (props: Props) => ({
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: props.isAdminUserMode ? userDashboard() : staffDashboard(),
        },
    ],
});

function Figure({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tracking-tight tabular-nums">
                {typeof children === 'number'
                    ? formatNumber(children)
                    : children}
            </dd>
        </div>
    );
}
