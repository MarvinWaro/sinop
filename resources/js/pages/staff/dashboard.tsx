import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    ClipboardList,
    Eye,
    ImageOff,
    Laptop,
    Minus,
    PackageCheck,
    PackageOpen,
    Plus,
    ShoppingCart,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import InputError from '@/components/input-error';
import { PageContainer } from '@/components/page-header';
import { SearchForm } from '@/components/search-form';
import { SignatureChoice } from '@/components/signature-choice';
import { ConditionBadge, RisStatusBadge } from '@/components/status-badges';
import { TablePanel } from '@/components/table-panel';
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCan } from '@/hooks/use-can';
import {
    formatDate,
    formatPeso,
    formatTime,
    initialsOf,
    truncate,
} from '@/lib/format';
import { risKey } from '@/lib/ris';
import { cn } from '@/lib/utils';
import { userDashboard } from '@/routes/admin';
import { receive, show as showRis, store as storeRis } from '@/routes/ris';
import { dashboard as staffDashboard } from '@/routes/staff';
import { forceChangePassword as forceChangePasswordRoute } from '@/routes/user';
import type {
    Department,
    Paginated,
    Property,
    RisSlip,
    SignatureType,
    SupplyStock,
} from '@/types';

type RequestableStock = SupplyStock & {
    available_for_request: number;
    is_requestable: boolean;
};

type Props = {
    forceChangePassword: boolean;
    isAdminUserMode: boolean;
    departments: Pick<Department, 'id' | 'name'>[];
    stocks: RequestableStock[];
    myRequests: Paginated<RisSlip>;
    receivedRequisitions: Paginated<RisSlip>;
    properties: Paginated<Property>;
    counts: {
        total: number;
        draft: number;
        approved: number;
        pendingReceipt: number;
        completed: number;
        declined: number;
    };
    filters: { status?: string; search?: string };
    notificationCounts: { approvedRequests: number; pendingReceipt: number };
};

type Section = 'requests' | 'received' | 'properties';

export default function StaffDashboard(props: Props) {
    const can = useCan();
    const { auth } = usePage().props;
    const user = auth.user;
    const homeUrl = props.isAdminUserMode
        ? userDashboard.url()
        : staffDashboard.url();

    const [section, setSection] = useState<Section>(() => {
        if (typeof window === 'undefined') {
            return 'requests';
        }

        const params = new URLSearchParams(window.location.search);

        if (params.has('received')) {
            return 'received';
        }

        if (params.has('properties')) {
            return 'properties';
        }

        return 'requests';
    });
    const [requesting, setRequesting] = useState(false);
    const [passwordPrompt, setPasswordPrompt] = useState(
        props.forceChangePassword,
    );

    const sections: {
        key: Section;
        label: string;
        icon: typeof ClipboardList;
        badge: number;
    }[] = [
        {
            key: 'requests',
            label: 'Requests',
            icon: ClipboardList,
            badge: props.notificationCounts.approvedRequests,
        },
        {
            key: 'received',
            label: 'Received supplies',
            icon: PackageCheck,
            badge: props.notificationCounts.pendingReceipt,
        },
        { key: 'properties', label: 'Properties', icon: Laptop, badge: 0 },
    ];

    return (
        <>
            <Head title="Home" />
            <PageContainer>
                {props.isAdminUserMode && (
                    <div className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
                        You are in{' '}
                        <span className="font-medium text-foreground">
                            user mode
                        </span>
                        . Requests you make here go through the same approval as
                        staff requests. Use the account menu to switch back.
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-12">
                    <aside className="space-y-4 lg:col-span-3">
                        <Card className="py-6">
                            <CardContent className="flex flex-col items-center gap-3 text-center">
                                <Avatar className="size-20">
                                    <AvatarImage
                                        src={user.avatar ?? undefined}
                                        alt={user.name}
                                        className="object-cover"
                                    />
                                    <AvatarFallback className="text-lg">
                                        {initialsOf(user.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-0.5">
                                    <p className="font-semibold">{user.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {user.designation?.name ?? '—'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {user.department?.name ?? '—'}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <nav
                            className="grid gap-1 rounded-xl border p-2"
                            aria-label="Dashboard sections"
                        >
                            {sections.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setSection(item.key)}
                                    className={cn(
                                        'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                                        section === item.key &&
                                            'bg-muted font-medium',
                                    )}
                                    aria-current={
                                        section === item.key
                                            ? 'page'
                                            : undefined
                                    }
                                >
                                    <span className="flex items-center gap-2">
                                        <item.icon className="size-4 text-muted-foreground" />
                                        {item.label}
                                    </span>
                                    {item.badge > 0 && (
                                        <Badge variant="secondary">
                                            {item.badge > 99
                                                ? '99+'
                                                : item.badge}
                                        </Badge>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </aside>

                    <div className="lg:col-span-9">
                        {section === 'requests' && (
                            <RequestsSection
                                requests={props.myRequests}
                                counts={props.counts}
                                filters={props.filters}
                                homeUrl={homeUrl}
                                onRequest={
                                    can('ris.request')
                                        ? () => setRequesting(true)
                                        : undefined
                                }
                            />
                        )}
                        {section === 'received' && (
                            <ReceivedSection
                                requisitions={props.receivedRequisitions}
                                userId={user.id}
                            />
                        )}
                        {section === 'properties' && (
                            <PropertiesSection properties={props.properties} />
                        )}
                    </div>
                </div>
            </PageContainer>

            <RequestSupplyDialog
                open={requesting}
                onOpenChange={setRequesting}
                stocks={props.stocks}
                departments={props.departments}
                defaultDivision={user.department_id}
            />

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
            title: 'Home',
            href: props.isAdminUserMode ? userDashboard() : staffDashboard(),
        },
    ],
});

/* -------------------------------------------------------------------------- */
/* My requests                                                                 */
/* -------------------------------------------------------------------------- */

function RequestsSection({
    requests,
    counts,
    filters,
    homeUrl,
    onRequest,
}: {
    requests: Paginated<RisSlip>;
    counts: Props['counts'];
    filters: Props['filters'];
    homeUrl: string;
    /** Left out when the user's roles don't allow requesting supplies. */
    onRequest?: () => void;
}) {
    const statusLinks: { value: string; label: string; count: number }[] = [
        { value: '', label: 'Total', count: counts.total },
        { value: 'draft', label: 'Pending', count: counts.draft },
        { value: 'approved', label: 'Approved', count: counts.approved },
        {
            value: 'pending-receipt',
            label: 'Pending receipt',
            count: counts.pendingReceipt,
        },
        { value: 'completed', label: 'Completed', count: counts.completed },
        { value: 'declined', label: 'Declined', count: counts.declined },
    ];

    const current = filters.status ?? '';

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    <CardTitle>My requests</CardTitle>
                    <CardDescription>
                        Track and manage your supply requisition requests
                    </CardDescription>
                </div>
                {onRequest && (
                    <Button onClick={onRequest}>
                        <Plus />
                        Request supply
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap gap-2">
                        {statusLinks.map((status) => (
                            <Button
                                key={status.label}
                                asChild
                                size="sm"
                                variant={
                                    current === status.value
                                        ? 'default'
                                        : 'outline'
                                }
                            >
                                <Link
                                    href={homeUrl}
                                    data={
                                        status.value
                                            ? { status: status.value }
                                            : {}
                                    }
                                    preserveScroll
                                    preserveState
                                >
                                    {status.label}
                                    <span className="tabular-nums opacity-70">
                                        {status.count}
                                    </span>
                                </Link>
                            </Button>
                        ))}
                    </div>
                    <SearchForm
                        url={homeUrl}
                        defaultValue={filters.search}
                        params={{ status: filters.status }}
                        placeholder="Search by RIS number..."
                    />
                </div>

                <TablePanel flush>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>RIS No</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <EmptyState
                                            title="No requests found"
                                            description={
                                                filters.status || filters.search
                                                    ? 'Try adjusting your filters or search term.'
                                                    : 'Get started by clicking the "Request supply" button.'
                                            }
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requests.data.map((request) => (
                                    <TableRow key={request.ris_id}>
                                        <TableCell className="font-medium">
                                            {request.ris_no}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>
                                                    {formatDate(
                                                        request.ris_date,
                                                    )}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatTime(
                                                        request.created_at,
                                                    )}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-normal">
                                            <RisStatusBadge slip={request} />
                                            {request.status === 'declined' &&
                                                request.decline_reason && (
                                                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                                        {truncate(
                                                            request.decline_reason,
                                                            50,
                                                        )}
                                                    </p>
                                                )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="icon"
                                                aria-label="View details"
                                            >
                                                <Link
                                                    href={showRis(
                                                        risKey(request),
                                                    )}
                                                >
                                                    <Eye />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TablePanel>

                <DataPagination paginator={requests} />
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/* Received supplies                                                           */
/* -------------------------------------------------------------------------- */

function ReceivedSection({
    requisitions,
    userId,
}: {
    requisitions: Paginated<RisSlip>;
    userId: number;
}) {
    const [receiving, setReceiving] = useState<RisSlip | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Supplies received</CardTitle>
                <CardDescription>
                    Supplies issued to you. Confirm receipt once you have the
                    items.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <TablePanel flush>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>RIS No</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Requested by</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requisitions.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <EmptyState
                                            icon={PackageOpen}
                                            title="No supplies received"
                                            description="You haven't received any supplies yet."
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requisitions.data.map((requisition) => {
                                    const canReceive =
                                        Number(requisition.received_by) ===
                                            userId &&
                                        !requisition.received_at &&
                                        requisition.status === 'posted' &&
                                        Boolean(requisition.issued_at);

                                    return (
                                        <TableRow key={requisition.ris_id}>
                                            <TableCell className="font-medium">
                                                {requisition.ris_no}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span>
                                                        {formatDate(
                                                            requisition.ris_date,
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatTime(
                                                            requisition.created_at,
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {requisition.requester?.name ??
                                                    'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canReceive ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={() =>
                                                                setReceiving(
                                                                    requisition,
                                                                )
                                                            }
                                                        >
                                                            Receive
                                                        </Button>
                                                    ) : requisition.received_at ? (
                                                        <span className="text-xs text-muted-foreground">
                                                            Received{' '}
                                                            {formatDate(
                                                                requisition.received_at,
                                                            )}
                                                        </span>
                                                    ) : null}
                                                    <Button
                                                        asChild
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label="View details"
                                                    >
                                                        <Link
                                                            href={showRis(
                                                                risKey(
                                                                    requisition,
                                                                ),
                                                            )}
                                                        >
                                                            <Eye />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TablePanel>
                <DataPagination paginator={requisitions} />
            </CardContent>

            <ReceiveDialog
                requisition={receiving}
                onClose={() => setReceiving(null)}
            />
        </Card>
    );
}

export function ReceiveDialog({
    requisition,
    onClose,
}: {
    requisition: RisSlip | null;
    onClose: () => void;
}) {
    const form = useForm<{ signature_type: SignatureType }>({
        signature_type: 'sgd',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!requisition) {
            return;
        }

        form.post(receive.url(risKey(requisition)), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <Dialog
            open={requisition !== null}
            onOpenChange={(open: boolean) => !open && onClose()}
        >
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Confirm receipt</DialogTitle>
                        <DialogDescription>
                            Confirm that you received the supplies for{' '}
                            {requisition?.ris_no}.
                        </DialogDescription>
                    </DialogHeader>
                    <SignatureChoice
                        value={form.data.signature_type}
                        onChange={(value) =>
                            form.setData('signature_type', value)
                        }
                    />
                    <InputError message={form.errors.signature_type} />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Confirm receipt
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/* -------------------------------------------------------------------------- */
/* Properties                                                                  */
/* -------------------------------------------------------------------------- */

function PropertiesSection({
    properties,
}: {
    properties: Paginated<Property>;
}) {
    const [viewing, setViewing] = useState<Property | null>(null);

    return (
        <Card>
            <CardHeader>
                <CardTitle>My properties</CardTitle>
                <CardDescription>
                    Property and equipment under your accountability (MR)
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                                className="overflow-hidden rounded-xl border text-left transition-colors hover:bg-muted/50"
                            >
                                <div className="flex aspect-video items-center justify-center bg-muted">
                                    {property.images?.[0] ? (
                                        <img
                                            src={property.images[0].url}
                                            alt={property.item_name}
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
            </CardContent>

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
        </Card>
    );
}

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

/* -------------------------------------------------------------------------- */
/* Request supply dialog                                                       */
/* -------------------------------------------------------------------------- */

type CartItem = {
    supply_id: number;
    name: string;
    description: string | null;
    unit: string;
    quantity: number;
    max: number;
};

type RequestForm = {
    entity_name: string;
    division: string;
    office: string;
    fund_cluster: string;
    responsibility_center_code: string;
    purpose: string;
    supplies: { supply_id: number; quantity: number }[];
    signature_type: SignatureType;
};

function RequestSupplyDialog({
    open,
    onOpenChange,
    stocks,
    departments,
    defaultDivision,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stocks: RequestableStock[];
    departments: Pick<Department, 'id' | 'name'>[];
    defaultDivision: number | null;
}) {
    const [step, setStep] = useState<'items' | 'confirm'>('items');
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [showCart, setShowCart] = useState(false);

    const form = useForm<RequestForm>({
        entity_name: 'CHEDRO 12',
        division: defaultDivision ? String(defaultDivision) : '',
        office: '',
        fund_cluster: '',
        responsibility_center_code: '',
        purpose: '',
        supplies: [],
        signature_type: 'sgd',
    });

    // One card per supply. A supply can have a stock row per fund cluster; the
    // server checks against the first available row, so use the largest.
    const products = useMemo(() => {
        const bySupply = new Map<
            number,
            { stock: RequestableStock; available: number }
        >();

        stocks.forEach((stock) => {
            if (!stock.supply) {
                return;
            }

            const existing = bySupply.get(stock.supply_id);

            if (!existing || stock.available_for_request > existing.available) {
                bySupply.set(stock.supply_id, {
                    stock,
                    available: stock.available_for_request,
                });
            }
        });

        return [...bySupply.values()].sort(
            (a, b) =>
                Number(b.available > 0) - Number(a.available > 0) ||
                (a.stock.supply?.item_name ?? '').localeCompare(
                    b.stock.supply?.item_name ?? '',
                ),
        );
    }, [stocks]);

    const term = search.trim().toLowerCase();
    const visibleProducts = term
        ? products.filter(({ stock }) =>
              `${stock.supply?.item_name ?? ''} ${stock.supply?.description ?? ''} ${stock.supply?.stock_no ?? ''}`
                  .toLowerCase()
                  .includes(term),
          )
        : products;

    const inCart = (supplyId: number) =>
        cart.find((item) => item.supply_id === supplyId)?.quantity ?? 0;

    const addToCart = (
        stock: RequestableStock,
        max: number,
        quantity: number,
    ) => {
        if (!stock.supply || quantity <= 0) {
            return;
        }

        setCart((current) => {
            const existing = current.find(
                (item) => item.supply_id === stock.supply_id,
            );

            if (existing) {
                return current.map((item) =>
                    item.supply_id === stock.supply_id
                        ? {
                              ...item,
                              quantity: Math.min(max, item.quantity + quantity),
                          }
                        : item,
                );
            }

            return [
                ...current,
                {
                    supply_id: stock.supply_id,
                    name: stock.supply?.item_name ?? '',
                    description: stock.supply?.description ?? null,
                    unit: stock.supply?.unit_of_measurement ?? '',
                    quantity: Math.min(max, quantity),
                    max,
                },
            ];
        });
        setQuantities((current) => ({ ...current, [stock.supply_id]: 0 }));
    };

    const addAll = () => {
        products.forEach(({ stock, available }) => {
            const quantity = quantities[stock.supply_id] ?? 0;

            if (quantity > 0) {
                addToCart(stock, available, quantity);
            }
        });
    };

    const updateCartQuantity = (supplyId: number, quantity: number) => {
        setCart((current) =>
            current
                .map((item) =>
                    item.supply_id === supplyId
                        ? {
                              ...item,
                              quantity: Math.max(
                                  0,
                                  Math.min(item.max, quantity),
                              ),
                          }
                        : item,
                )
                .filter((item) => item.quantity > 0),
        );
    };

    const reset = () => {
        form.reset();
        form.clearErrors();
        setCart([]);
        setQuantities({});
        setSearch('');
        setStep('items');
        setShowCart(false);
    };

    const close = (value: boolean) => {
        onOpenChange(value);

        if (!value) {
            reset();
        }
    };

    const goToConfirm = () => {
        if (cart.length === 0) {
            form.setError('supplies', 'Add at least one item to your request.');

            return;
        }

        if (!form.data.purpose.trim()) {
            form.setError(
                'purpose',
                'Please enter the purpose of the request.',
            );

            return;
        }

        form.clearErrors();
        setStep('confirm');
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.transform((data) => ({
            ...data,
            supplies: cart.map((item) => ({
                supply_id: item.supply_id,
                quantity: item.quantity,
            })),
        }));

        form.post(storeRis.url(), {
            preserveScroll: true,
            onSuccess: () => close(false),
            onError: () => setStep('items'),
        });
    };

    const stockErrors = Object.entries(
        form.errors as Record<string, string | undefined>,
    )
        .filter(([key]) => key.startsWith('supplies.'))
        .map(([, message]) => message)
        .filter(Boolean);

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Request supplies</DialogTitle>
                    <DialogDescription>
                        Fill in the requisition details, then add the items you
                        need.
                    </DialogDescription>
                </DialogHeader>

                {step === 'items' ? (
                    <div className="-mx-6 flex-1 space-y-5 overflow-y-auto px-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                label="Entity name"
                                htmlFor="entity_name"
                                error={form.errors.entity_name}
                                required
                            >
                                <Input
                                    id="entity_name"
                                    value={form.data.entity_name}
                                    onChange={(e) =>
                                        form.setData(
                                            'entity_name',
                                            e.target.value,
                                        )
                                    }
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Division"
                                htmlFor="division"
                                error={form.errors.division}
                                required
                            >
                                <NativeSelect
                                    id="division"
                                    value={form.data.division}
                                    onChange={(e) =>
                                        form.setData('division', e.target.value)
                                    }
                                    required
                                >
                                    <option value="" disabled>
                                        Select division
                                    </option>
                                    {departments.map((department) => (
                                        <option
                                            key={department.id}
                                            value={department.id}
                                        >
                                            {department.name}
                                        </option>
                                    ))}
                                </NativeSelect>
                            </FormField>
                            <FormField
                                label="Office"
                                htmlFor="office"
                                error={form.errors.office}
                            >
                                <Input
                                    id="office"
                                    value={form.data.office}
                                    onChange={(e) =>
                                        form.setData('office', e.target.value)
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Responsibility center code"
                                htmlFor="responsibility_center_code"
                                error={form.errors.responsibility_center_code}
                            >
                                <Input
                                    id="responsibility_center_code"
                                    value={form.data.responsibility_center_code}
                                    onChange={(e) =>
                                        form.setData(
                                            'responsibility_center_code',
                                            e.target.value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Purpose"
                                htmlFor="purpose"
                                error={form.errors.purpose}
                                required
                                className="md:col-span-2"
                            >
                                <Textarea
                                    id="purpose"
                                    rows={2}
                                    value={form.data.purpose}
                                    onChange={(e) =>
                                        form.setData('purpose', e.target.value)
                                    }
                                    required
                                />
                            </FormField>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="font-medium">
                                    {showCart
                                        ? 'Selected items'
                                        : 'Select items to request'}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {!showCart && (
                                        <>
                                            <Input
                                                type="search"
                                                placeholder="Search items..."
                                                value={search}
                                                onChange={(e) =>
                                                    setSearch(e.target.value)
                                                }
                                                className="sm:w-56"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={addAll}
                                            >
                                                Add all to request
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        type="button"
                                        variant={
                                            showCart ? 'outline' : 'secondary'
                                        }
                                        onClick={() =>
                                            setShowCart((value) => !value)
                                        }
                                        disabled={
                                            cart.length === 0 && !showCart
                                        }
                                    >
                                        <ShoppingCart />
                                        {showCart
                                            ? 'Back to items'
                                            : `View selected (${cart.length})`}
                                    </Button>
                                </div>
                            </div>

                            <InputError message={form.errors.supplies} />
                            {stockErrors.length > 0 && (
                                <ul className="list-disc space-y-1 rounded-md border border-destructive/40 bg-destructive/5 py-2 pr-3 pl-7 text-sm text-destructive">
                                    {stockErrors.map((message) => (
                                        <li key={message}>{message}</li>
                                    ))}
                                </ul>
                            )}

                            {showCart ? (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item</TableHead>
                                                <TableHead className="w-40 text-center">
                                                    Quantity
                                                </TableHead>
                                                <TableHead className="w-12" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cart.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3}>
                                                        <EmptyState title="No items selected" />
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                cart.map((item) => (
                                                    <TableRow
                                                        key={item.supply_id}
                                                    >
                                                        <TableCell className="whitespace-normal">
                                                            <p className="font-medium">
                                                                {item.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {[
                                                                    item.description,
                                                                    item.unit,
                                                                ]
                                                                    .filter(
                                                                        Boolean,
                                                                    )
                                                                    .join(
                                                                        ' · ',
                                                                    )}
                                                            </p>
                                                        </TableCell>
                                                        <TableCell>
                                                            <QuantityStepper
                                                                value={
                                                                    item.quantity
                                                                }
                                                                max={item.max}
                                                                onChange={(
                                                                    value,
                                                                ) =>
                                                                    updateCartQuantity(
                                                                        item.supply_id,
                                                                        value,
                                                                    )
                                                                }
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() =>
                                                                    updateCartQuantity(
                                                                        item.supply_id,
                                                                        0,
                                                                    )
                                                                }
                                                                aria-label={`Remove ${item.name}`}
                                                            >
                                                                <Trash2 />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : visibleProducts.length === 0 ? (
                                <EmptyState title="No items match your search" />
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {visibleProducts.map(
                                        ({ stock, available }) => {
                                            const remaining = Math.max(
                                                0,
                                                available -
                                                    inCart(stock.supply_id),
                                            );
                                            const quantity =
                                                quantities[stock.supply_id] ??
                                                0;

                                            return (
                                                <div
                                                    key={stock.supply_id}
                                                    className={cn(
                                                        'flex flex-col gap-3 rounded-lg border p-3',
                                                        available <= 0 &&
                                                            'opacity-60',
                                                    )}
                                                >
                                                    <div className="space-y-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="font-medium">
                                                                {
                                                                    stock.supply
                                                                        ?.item_name
                                                                }
                                                            </p>
                                                            <Badge
                                                                variant={
                                                                    remaining >
                                                                    0
                                                                        ? 'secondary'
                                                                        : 'outline'
                                                                }
                                                            >
                                                                {available <= 0
                                                                    ? 'Out of stock'
                                                                    : `${remaining} available`}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            {[
                                                                stock.supply
                                                                    ?.description,
                                                                stock.supply
                                                                    ?.unit_of_measurement,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </p>
                                                    </div>
                                                    <div className="mt-auto flex items-center gap-2">
                                                        <QuantityStepper
                                                            value={quantity}
                                                            max={remaining}
                                                            disabled={
                                                                remaining <= 0
                                                            }
                                                            onChange={(value) =>
                                                                setQuantities(
                                                                    (
                                                                        current,
                                                                    ) => ({
                                                                        ...current,
                                                                        [stock.supply_id]:
                                                                            value,
                                                                    }),
                                                                )
                                                            }
                                                        />
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={
                                                                quantity <= 0
                                                            }
                                                            onClick={() =>
                                                                addToCart(
                                                                    stock,
                                                                    available,
                                                                    quantity,
                                                                )
                                                            }
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        },
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <form
                        id="request-confirm"
                        onSubmit={submit}
                        className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6"
                    >
                        <div className="rounded-md border p-4 text-sm">
                            <p className="font-medium">Purpose</p>
                            <p className="text-muted-foreground">
                                {form.data.purpose}
                            </p>
                            <p className="mt-3 font-medium">
                                Items ({cart.length})
                            </p>
                            <ul className="mt-1 space-y-1 text-muted-foreground">
                                {cart.map((item) => (
                                    <li key={item.supply_id}>
                                        {item.quantity} × {item.name}
                                        {item.unit ? ` (${item.unit})` : ''}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <SignatureChoice
                            value={form.data.signature_type}
                            onChange={(value) =>
                                form.setData('signature_type', value)
                            }
                        />
                    </form>
                )}

                <DialogFooter className="border-t pt-4">
                    {step === 'items' ? (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => close(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="button" onClick={goToConfirm}>
                                Continue ({cart.length}{' '}
                                {cart.length === 1 ? 'item' : 'items'})
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep('items')}
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                form="request-confirm"
                                disabled={form.processing}
                            >
                                Submit request
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function QuantityStepper({
    value,
    max,
    onChange,
    disabled = false,
}: {
    value: number;
    max: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}) {
    const clamp = (next: number) =>
        Math.max(0, Math.min(max, Number.isFinite(next) ? next : 0));

    return (
        <div className="flex items-center rounded-md border">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-r-none"
                onClick={() => onChange(clamp(value - 1))}
                disabled={disabled || value <= 0}
                aria-label="Decrease quantity"
            >
                <Minus />
            </Button>
            <input
                type="number"
                min={0}
                max={max}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
                className="h-8 w-14 [appearance:textfield] border-x bg-transparent text-center text-sm outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Quantity"
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-l-none"
                onClick={() => onChange(clamp(value + 1))}
                disabled={disabled || value >= max}
                aria-label="Increase quantity"
            >
                <Plus />
            </Button>
        </div>
    );
}
