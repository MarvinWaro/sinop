import { Head, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    FileSpreadsheet,
    PackageCheck,
    Printer,
    Send,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import InputError from '@/components/input-error';
import { PageContainer, PageHeader } from '@/components/page-header';
import { SignatureChoice } from '@/components/signature-choice';
import { RisStatusBadge } from '@/components/status-badges';
import { TablePanel } from '@/components/table-panel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useLiveProps } from '@/hooks/use-inbox';
import { formatDateTime, formatLongDate, toNumber } from '@/lib/format';
import { risKey, supplyLabel } from '@/lib/ris';
import {
    approve,
    decline,
    exportExcel,
    index as risIndex,
    issue,
    print,
    receive,
    show as showRis,
} from '@/routes/ris';
import type { AppUser, RisItem, RisSlip, SignatureType } from '@/types';

type Recipients = {
    department: string;
    users: { id: number; name: string; designation: string | null }[];
}[];

type Props = {
    risSlip: RisSlip & { items: RisItem[] };
    recipients: Recipients;
    permissions: {
        canApprove: boolean;
        canDecline: boolean;
        canIssue: boolean;
        canReceive: boolean;
    };
};

const approveTerms = [
    'I authorize the use of my electronic signature for this approval.',
    'I understand this e-signature has the same legal validity as my handwritten signature.',
    'I confirm I have reviewed this requisition and approve it.',
];

const issueTerms = [
    'I authorize the use of my electronic signature for this issuance.',
    'I understand this e-signature has the same legal validity as my handwritten signature.',
    'I confirm the quantities issued are correct.',
];

const receiveTerms = [
    'I authorize the use of my electronic signature to confirm receipt.',
    'I understand this e-signature has the same legal validity as my handwritten signature.',
    'I confirm I have received all the items as specified.',
];

export default function RisShow({ risSlip, recipients, permissions }: Props) {
    const { errors } = usePage().props as { errors?: Record<string, string> };
    // Approved, issued or received elsewhere: the slip updates here.
    useLiveProps(['risSlip', 'permissions']);
    const [approving, setApproving] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [issuing, setIssuing] = useState(false);

    const key = risKey(risSlip);

    return (
        <>
            <Head title={`RIS ${risSlip.ris_no}`} />
            <PageContainer>
                <PageHeader
                    title={`Requisition and Issue Slip ${risSlip.ris_no}`}
                    description={
                        <span className="flex flex-wrap items-center gap-2">
                            <RisStatusBadge slip={risSlip} />
                            {risSlip.is_manual_entry && (
                                <Badge variant="outline">Manual entry</Badge>
                            )}
                        </span>
                    }
                    actions={
                        <>
                            <Button asChild variant="outline">
                                <a
                                    href={print.url(key)}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <Printer />
                                    Print
                                </a>
                            </Button>
                            <Button asChild variant="outline">
                                <a href={exportExcel.url(key)}>
                                    <FileSpreadsheet />
                                    Export Excel
                                </a>
                            </Button>
                            {permissions.canDecline && (
                                <Button
                                    variant="outline"
                                    onClick={() => setDeclining(true)}
                                >
                                    <XCircle />
                                    Decline
                                </Button>
                            )}
                            {permissions.canApprove && (
                                <Button onClick={() => setApproving(true)}>
                                    <CheckCircle2 />
                                    Approve
                                </Button>
                            )}
                            {permissions.canIssue && (
                                <Button onClick={() => setIssuing(true)}>
                                    <Send />
                                    Process issuance
                                </Button>
                            )}
                        </>
                    }
                />

                {errors?.issue_validation && (
                    <Alert variant="destructive">
                        <AlertTitle>Issuance not processed</AlertTitle>
                        <AlertDescription>
                            {errors.issue_validation}
                        </AlertDescription>
                    </Alert>
                )}

                {risSlip.status === 'declined' && risSlip.decline_reason && (
                    <Alert variant="destructive">
                        <XCircle />
                        <AlertTitle>Decline reason</AlertTitle>
                        <AlertDescription>
                            <p>{risSlip.decline_reason}</p>
                            <p className="text-xs">
                                Declined by {risSlip.decliner?.name ?? 'N/A'} on{' '}
                                {formatDateTime(risSlip.declined_at)}
                            </p>
                        </AlertDescription>
                    </Alert>
                )}

                {permissions.canReceive && <ReceivePanel risSlip={risSlip} />}

                <Card>
                    <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Info label="Entity name" value={risSlip.entity_name} />
                        <Info
                            label="Fund cluster"
                            value={risSlip.fund_cluster}
                        />
                        <Info
                            label="RIS date"
                            value={formatLongDate(risSlip.ris_date)}
                        />
                        <Info label="RIS no." value={risSlip.ris_no} />
                        <Info
                            label="Division"
                            value={risSlip.department?.name}
                        />
                        <Info label="Office" value={risSlip.office} />
                        <Info
                            label="Responsibility center code"
                            value={risSlip.responsibility_center_code}
                        />
                        <Info
                            label="Purpose"
                            value={risSlip.purpose}
                            className="sm:col-span-2 lg:col-span-4"
                        />
                        {risSlip.is_manual_entry && (
                            <Info
                                label="Manual entry"
                                value={[
                                    risSlip.manual_entry_notes,
                                    risSlip.reference_source &&
                                        `Reference: ${risSlip.reference_source}`,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                className="sm:col-span-2 lg:col-span-4"
                            />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <TablePanel flush>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Stock no.</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-right">
                                            Requested
                                        </TableHead>
                                        <TableHead>Stock available?</TableHead>
                                        <TableHead className="text-right">
                                            Issued
                                        </TableHead>
                                        <TableHead>Remarks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {risSlip.items.map((item) => (
                                        <TableRow key={item.item_id}>
                                            <TableCell className="font-mono">
                                                {item.supply?.stock_no ?? 'N/A'}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                {supplyLabel(item.supply)}
                                            </TableCell>
                                            <TableCell>
                                                {item.supply
                                                    ?.unit_of_measurement ??
                                                    '—'}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.quantity_requested}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        item.stock_available
                                                            ? 'secondary'
                                                            : 'outline'
                                                    }
                                                >
                                                    {item.stock_available
                                                        ? 'Yes'
                                                        : 'No'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.quantity_issued ?? (
                                                    <span className="text-muted-foreground">
                                                        Pending
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-normal text-muted-foreground">
                                                {item.remarks ?? ''}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TablePanel>
                    </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Signatory
                        label="Requested by"
                        user={risSlip.requester}
                        signed={Boolean(risSlip.requester)}
                        signatureType={risSlip.requester_signature_type}
                        date={risSlip.created_at}
                    />
                    {risSlip.status === 'declined' && risSlip.declined_by ? (
                        <Signatory
                            label="Declined by"
                            user={risSlip.decliner}
                            signed
                            declined
                            signatureType="sgd"
                            date={risSlip.declined_at}
                        />
                    ) : (
                        <Signatory
                            label="Approved by"
                            user={risSlip.approver}
                            signed={Boolean(risSlip.approved_by)}
                            signatureType={risSlip.approver_signature_type}
                            date={risSlip.approved_at}
                        />
                    )}
                    <Signatory
                        label="Issued by"
                        user={risSlip.issuer}
                        signed={Boolean(risSlip.issued_by)}
                        signatureType={risSlip.issuer_signature_type}
                        date={risSlip.issued_at}
                    />
                    <Signatory
                        label="Received by"
                        user={risSlip.receiver}
                        signed={Boolean(
                            risSlip.received_by && risSlip.received_at,
                        )}
                        signatureType={risSlip.receiver_signature_type}
                        date={risSlip.received_at}
                        pendingLabel={
                            risSlip.received_by
                                ? 'Pending confirmation'
                                : 'Pending'
                        }
                    />
                </div>
            </PageContainer>

            {permissions.canApprove && (
                <ApproveDialog
                    risSlip={risSlip}
                    open={approving}
                    onOpenChange={setApproving}
                />
            )}
            {permissions.canDecline && (
                <DeclineDialog
                    risSlip={risSlip}
                    open={declining}
                    onOpenChange={setDeclining}
                />
            )}
            {permissions.canIssue && (
                <IssueDialog
                    risSlip={risSlip}
                    recipients={recipients}
                    open={issuing}
                    onOpenChange={setIssuing}
                />
            )}
        </>
    );
}

RisShow.layout = (props: Props) => ({
    breadcrumbs: [
        { title: 'Requisitions', href: risIndex() },
        { title: props.risSlip.ris_no, href: showRis(risKey(props.risSlip)) },
    ],
});

function Info({
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
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="font-medium whitespace-pre-line">{value || 'N/A'}</p>
        </div>
    );
}

function Signatory({
    label,
    user,
    signed,
    signatureType,
    date,
    declined = false,
    pendingLabel = 'Pending',
}: {
    label: string;
    user: AppUser | null | undefined;
    signed: boolean;
    signatureType: SignatureType;
    date: string | null;
    declined?: boolean;
    pendingLabel?: string;
}) {
    return (
        <Card className="gap-3 py-4">
            <CardContent className="space-y-3 px-4">
                <p className="text-sm font-medium text-muted-foreground">
                    {label}
                </p>
                <div className="flex h-16 items-end justify-center border-b">
                    {declined ? (
                        <span className="pb-2 text-sm font-semibold text-destructive">
                            DECLINED
                        </span>
                    ) : signed &&
                      signatureType === 'esign' &&
                      user?.signature_url ? (
                        <img
                            src={user.signature_url}
                            alt={`${label} signature`}
                            className="max-h-14 mix-blend-multiply dark:invert"
                        />
                    ) : signed ? (
                        <span className="pb-2 text-sm font-semibold italic">
                            SGD
                        </span>
                    ) : null}
                </div>
                {user ? (
                    <div className="text-center">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {user.designation?.name ?? 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {date ? formatDateTime(date) : pendingLabel}
                        </p>
                    </div>
                ) : (
                    <p className="text-center text-sm text-muted-foreground">
                        {pendingLabel}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function ApproveDialog({
    risSlip,
    open,
    onOpenChange,
}: {
    risSlip: RisSlip;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [agreed, setAgreed] = useState(false);
    const form = useForm<{
        fund_cluster: string;
        signature_type: SignatureType;
    }>({
        fund_cluster: risSlip.fund_cluster === '151' ? '151' : '101',
        signature_type: 'sgd',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(approve.url(risKey(risSlip)), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Approve RIS {risSlip.ris_no}</DialogTitle>
                        <DialogDescription>
                            Approved requests are forwarded to the admin for
                            issuance.
                        </DialogDescription>
                    </DialogHeader>
                    <FormField
                        label="Fund cluster"
                        htmlFor="approve-fund-cluster"
                        error={form.errors.fund_cluster}
                    >
                        <FormSelect
                            id="approve-fund-cluster"
                            value={form.data.fund_cluster}
                            onValueChange={(value) =>
                                form.setData('fund_cluster', value)
                            }
                            options={[
                                { value: '101', label: '101' },
                                { value: '151', label: '151' },
                            ]}
                        />
                    </FormField>
                    <SignatureChoice
                        value={form.data.signature_type}
                        onChange={(value) =>
                            form.setData('signature_type', value)
                        }
                        terms={approveTerms}
                        agreed={agreed}
                        onAgreedChange={setAgreed}
                    />
                    <InputError message={form.errors.signature_type} />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                form.processing ||
                                (form.data.signature_type === 'esign' &&
                                    !agreed)
                            }
                        >
                            Approve request
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeclineDialog({
    risSlip,
    open,
    onOpenChange,
}: {
    risSlip: RisSlip;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({ decline_reason: '' });
    const length = form.data.decline_reason.trim().length;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(decline.url(risKey(risSlip)), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={submit} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Decline RIS {risSlip.ris_no}</DialogTitle>
                        <DialogDescription>
                            The requester will be notified with your reason.
                            This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <FormField
                        label="Reason for declining"
                        htmlFor="decline_reason"
                        error={form.errors.decline_reason}
                        hint={`${length}/500 characters (minimum 10)`}
                        required
                    >
                        <Textarea
                            id="decline_reason"
                            rows={4}
                            minLength={10}
                            maxLength={500}
                            value={form.data.decline_reason}
                            onChange={(e) =>
                                form.setData('decline_reason', e.target.value)
                            }
                            required
                        />
                    </FormField>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={form.processing || length < 10}
                        >
                            Decline request
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

type IssueItem = { item_id: number; quantity_issued: number; remarks: string };

function IssueDialog({
    risSlip,
    recipients,
    open,
    onOpenChange,
}: {
    risSlip: RisSlip & { items: RisItem[] };
    recipients: Recipients;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [agreed, setAgreed] = useState(false);

    // Same rules as the Blade view: issue at least 1 when stock exists, at most
    // min(requested, available); 0 only when nothing is available.
    const limits = risSlip.items.map((item) => {
        const available = toNumber(item.total_available);
        const max = Math.min(available, item.quantity_requested);

        return {
            available,
            matching: toNumber(item.matching_fund_available),
            min: available > 0 ? 1 : 0,
            max,
        };
    });

    const form = useForm<{
        items: IssueItem[];
        received_by: string;
        signature_type: SignatureType;
    }>({
        items: risSlip.items.map((item, index) => {
            const limit = limits[index];

            return {
                item_id: item.item_id,
                quantity_issued:
                    limit.available > 0 ? Math.max(1, limit.max) : 0,
                remarks:
                    limit.available <= 0
                        ? 'Cannot issue - out of stock'
                        : limit.available < item.quantity_requested
                          ? 'Partial fulfillment - insufficient stock'
                          : '',
            };
        }),
        received_by: risSlip.requested_by ? String(risSlip.requested_by) : '',
        signature_type: 'sgd',
    });

    const updateItem = (index: number, patch: Partial<IssueItem>) => {
        form.setData(
            'items',
            form.data.items.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );
    };

    const invalidRows = form.data.items.filter((item, index) => {
        const limit = limits[index];

        return (
            item.quantity_issued < limit.min || item.quantity_issued > limit.max
        );
    }).length;
    const nothingToIssue = form.data.items.every(
        (item) => item.quantity_issued <= 0,
    );

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(issue.url(risKey(risSlip)), {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>
                        Issue supplies for RIS {risSlip.ris_no}
                    </DialogTitle>
                    <DialogDescription>
                        Issue at least 1 unit for items with stock; the maximum
                        is the requested amount or the available stock,
                        whichever is lower. Zero is only allowed when nothing is
                        available.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="issue-form"
                    onSubmit={submit}
                    className="-mx-6 flex-1 space-y-5 overflow-y-auto px-6"
                >
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">
                                        Requested
                                    </TableHead>
                                    <TableHead>Available</TableHead>
                                    <TableHead className="w-32">
                                        Issue quantity
                                    </TableHead>
                                    <TableHead className="w-56">
                                        Remarks
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {risSlip.items.map((item, index) => {
                                    const limit = limits[index];
                                    const row = form.data.items[index];
                                    const invalid =
                                        row.quantity_issued < limit.min ||
                                        row.quantity_issued > limit.max;

                                    return (
                                        <TableRow
                                            key={item.item_id}
                                            className="align-top"
                                        >
                                            <TableCell className="whitespace-normal">
                                                <p className="font-medium">
                                                    {item.supply?.item_name ??
                                                        'N/A'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Stock #
                                                    {item.supply?.stock_no ??
                                                        'N/A'}
                                                </p>
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.quantity_requested}
                                            </TableCell>
                                            <TableCell className="whitespace-normal">
                                                {limit.available >=
                                                item.quantity_requested ? (
                                                    <Badge variant="secondary">
                                                        {limit.available}{' '}
                                                        available
                                                    </Badge>
                                                ) : limit.available > 0 ? (
                                                    <Badge variant="outline">
                                                        Only {limit.available}{' '}
                                                        available
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="destructive">
                                                        Out of stock
                                                    </Badge>
                                                )}
                                                {limit.matching > 0 &&
                                                    limit.matching <
                                                        limit.available && (
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            ({limit.matching}{' '}
                                                            from fund{' '}
                                                            {
                                                                risSlip.fund_cluster
                                                            }
                                                            )
                                                        </p>
                                                    )}
                                            </TableCell>
                                            <TableCell>
                                                {limit.available > 0 ? (
                                                    <div className="grid gap-1">
                                                        <Input
                                                            type="number"
                                                            min={limit.min}
                                                            max={limit.max}
                                                            value={
                                                                row.quantity_issued
                                                            }
                                                            aria-invalid={
                                                                invalid ||
                                                                undefined
                                                            }
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        quantity_issued:
                                                                            parseInt(
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                                10,
                                                                            ) ||
                                                                            0,
                                                                    },
                                                                )
                                                            }
                                                            aria-label={`Issue quantity for ${item.supply?.item_name ?? 'item'}`}
                                                        />
                                                        <span className="text-xs text-muted-foreground">
                                                            Min {limit.min}, max{' '}
                                                            {limit.max}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        Cannot issue
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={row.remarks}
                                                    readOnly={
                                                        limit.available <= 0
                                                    }
                                                    placeholder="Optional remarks"
                                                    onChange={(e) =>
                                                        updateItem(index, {
                                                            remarks:
                                                                e.target.value,
                                                        })
                                                    }
                                                    aria-label="Remarks"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    {invalidRows > 0 && (
                        <p className="text-sm text-destructive">
                            {invalidRows}{' '}
                            {invalidRows === 1 ? 'item has' : 'items have'} an
                            issue quantity outside the allowed range.
                        </p>
                    )}

                    <FormField
                        label="Received by"
                        htmlFor="received_by"
                        error={form.errors.received_by}
                        required
                    >
                        <FormSelect
                            id="received_by"
                            value={form.data.received_by}
                            onValueChange={(value) =>
                                form.setData('received_by', value)
                            }
                            required
                            placeholder="Select recipient..."
                            groups={recipients.map((group) => ({
                                label: group.department,
                                options: group.users.map((user) => ({
                                    value: user.id,
                                    label: user.designation
                                        ? `${user.name} - ${user.designation}`
                                        : user.name,
                                })),
                            }))}
                        />
                    </FormField>

                    <SignatureChoice
                        value={form.data.signature_type}
                        onChange={(value) =>
                            form.setData('signature_type', value)
                        }
                        terms={issueTerms}
                        agreed={agreed}
                        onAgreedChange={setAgreed}
                    />
                </form>

                <DialogFooter className="border-t pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="issue-form"
                        disabled={
                            form.processing ||
                            invalidRows > 0 ||
                            nothingToIssue ||
                            (form.data.signature_type === 'esign' && !agreed)
                        }
                    >
                        Issue supplies
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ReceivePanel({ risSlip }: { risSlip: RisSlip }) {
    const [agreed, setAgreed] = useState(false);
    const form = useForm<{ signature_type: SignatureType }>({
        signature_type: 'sgd',
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(receive.url(risKey(risSlip)), { preserveScroll: true });
    };

    return (
        <Card className="border-primary/40">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <PackageCheck className="size-5" />
                    Confirm receipt of supplies
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={submit} className="grid gap-4">
                    <p className="text-sm text-muted-foreground">
                        These supplies have been issued to you. Please confirm
                        receipt.
                    </p>
                    <SignatureChoice
                        value={form.data.signature_type}
                        onChange={(value) =>
                            form.setData('signature_type', value)
                        }
                        terms={receiveTerms}
                        agreed={agreed}
                        onAgreedChange={setAgreed}
                    />
                    <InputError message={form.errors.signature_type} />
                    <div>
                        <Button
                            type="submit"
                            disabled={
                                form.processing ||
                                (form.data.signature_type === 'esign' &&
                                    !agreed)
                            }
                        >
                            Confirm receipt
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
