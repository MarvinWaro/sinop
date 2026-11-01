import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    CheckCircle2,
    FileSpreadsheet,
    MessageSquare,
    PackageCheck,
    Send,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import InputError from '@/components/input-error';
import { PageContainer, PageHeader } from '@/components/page-header';
import {
    signatureError,
    SignatureChoice,
    signatureReady,
} from '@/components/signature-choice';
import { SignatureBox } from '@/components/signature/signature-box';
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
import { useCan } from '@/hooks/use-can';
import { useLiveProps } from '@/hooks/use-inbox';
import { formatDateTime, formatLongDate, toNumber } from '@/lib/format';
import { risKey, supplyLabel } from '@/lib/ris';
import { boxAspect } from '@/lib/signature-placement';
import { index as messagesIndex } from '@/routes/messages';
import {
    approve,
    decline,
    exportExcel,
    index as risIndex,
    issue,
    receive,
    show as showRis,
    signature as risSignature,
} from '@/routes/ris';
import type {
    AppUser,
    BoxSignature,
    PlacedSignature,
    RisItem,
    RisSlip,
    RisSlipSignature,
    SignatureType,
    SignStep,
} from '@/types';

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
    const { auth, errors } = usePage().props as {
        auth: { user: AppUser; isAdminUserMode: boolean };
        errors?: Record<string, string>;
    };
    const can = useCan();
    // Approved, issued or received elsewhere: the slip updates here.
    useLiveProps(['risSlip', 'permissions']);
    const [approving, setApproving] = useState(false);
    const [declining, setDeclining] = useState(false);
    const [issuing, setIssuing] = useState(false);

    const key = risKey(risSlip);
    // Questions about this request go to Messages: the requester writes to
    // the supply office, the office writes to the requester.
    const ownRequest = risSlip.requested_by === auth.user.id;
    const messageLabel =
        can('messages.office') && !auth.isAdminUserMode && !ownRequest
            ? 'Message requester'
            : ownRequest || risSlip.received_by === auth.user.id
              ? 'Message supply office'
              : null;

    return (
        <>
            <Head title={risSlip.ris_no} />
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
                            {messageLabel && (
                                <Button asChild variant="outline">
                                    <Link
                                        href={messagesIndex({
                                            query: { ris: risSlip.route_key },
                                        })}
                                    >
                                        <MessageSquare />
                                        {messageLabel}
                                    </Link>
                                </Button>
                            )}
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
                        step="requested"
                        frozen={risSlip.signatures}
                        label="Requested by"
                        user={risSlip.requester}
                        signed={Boolean(risSlip.requester)}
                        signatureType={risSlip.requester_signature_type}
                        date={risSlip.created_at}
                    />
                    {risSlip.status === 'declined' && risSlip.declined_by ? (
                        <Signatory
                            step="approved"
                            label="Declined by"
                            user={risSlip.decliner}
                            signed
                            declined
                            signatureType="sgd"
                            date={risSlip.declined_at}
                        />
                    ) : (
                        <Signatory
                            step="approved"
                            frozen={risSlip.signatures}
                            label="Approved by"
                            user={risSlip.approver}
                            signed={Boolean(risSlip.approved_by)}
                            signatureType={risSlip.approver_signature_type}
                            date={risSlip.approved_at}
                        />
                    )}
                    <Signatory
                        step="issued"
                        frozen={risSlip.signatures}
                        label="Issued by"
                        user={risSlip.issuer}
                        signed={Boolean(risSlip.issued_by)}
                        signatureType={risSlip.issuer_signature_type}
                        date={risSlip.issued_at}
                    />
                    <Signatory
                        step="received"
                        frozen={risSlip.signatures}
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
    step,
    frozen = [],
    label,
    user,
    signed,
    signatureType,
    date,
    declined = false,
    pendingLabel = 'Pending',
}: {
    step: SignStep;
    /** The slip's frozen e-signatures. */
    frozen?: RisSlipSignature[];
    label: string;
    user: AppUser | null | undefined;
    signed: boolean;
    signatureType: SignatureType;
    date: string | null;
    declined?: boolean;
    pendingLabel?: string;
}) {
    const { risSlip } = usePage<Props>().props;
    // Where the signer placed it; slips signed before that show the
    // person's current signature, centred, loaded through the RIS so only
    // people who may open it see it.
    const placed = frozen.find((signature) => signature.step === step);
    const signature: BoxSignature | null = placed
        ? { url: placed.url, placement: placed }
        : user?.signature_url
          ? {
                url: risSignature.url({ risSlip: risKey(risSlip), step }),
                placement: null,
            }
          : null;

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
                    ) : signed && signatureType === 'esign' && signature ? (
                        <SignatureBox
                            step={step}
                            signature={signature}
                            label={`${label} signature`}
                            // As wide as fits, never taller than the line.
                            style={{ maxWidth: `${4 * boxAspect(step)}rem` }}
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
        signature: PlacedSignature | null;
    }>({
        fund_cluster: risSlip.fund_cluster === '151' ? '151' : '101',
        signature_type: 'sgd',
        signature: null,
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
                        <DialogTitle>Approve {risSlip.ris_no}</DialogTitle>
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
                        step="approved"
                        document={{ slip: risSlip }}
                        signature={form.data.signature}
                        onSignatureChange={(signature) =>
                            form.setData('signature', signature)
                        }
                        terms={approveTerms}
                        agreed={agreed}
                        onAgreedChange={setAgreed}
                    />
                    <InputError
                        message={
                            form.errors.signature_type ??
                            signatureError(form.errors)
                        }
                    />
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
                                    !agreed) ||
                                !signatureReady(
                                    form.data.signature_type,
                                    form.data.signature,
                                )
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
                        <DialogTitle>Decline {risSlip.ris_no}</DialogTitle>
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

    // Same rules as RisSlipController@issue: at most min(requested,
    // available); less, down to 0, only with a reason in the remarks.
    const limits = risSlip.items.map((item) => {
        const available = toNumber(item.total_available);
        const max = Math.min(available, item.quantity_requested);

        return {
            available,
            matching: toNumber(item.matching_fund_available),
            min: 0,
            max,
        };
    });

    const form = useForm<{
        items: IssueItem[];
        received_by: string;
        signature_type: SignatureType;
        signature: PlacedSignature | null;
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
        signature: null,
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
    // Holding back stock that could be issued needs a reason.
    const needsReason = (item: IssueItem, index: number) =>
        item.quantity_issued < limits[index].max && item.remarks.trim() === '';
    const missingReasons = form.data.items.filter(needsReason).length;
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
                        Issue supplies for {risSlip.ris_no}
                    </DialogTitle>
                    <DialogDescription>
                        Up to the requested amount or the available stock,
                        whichever is lower. You can issue less, even 0 (for
                        example, stock held in reserve), but say why in the
                        remarks. At least one item must be issued.
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
                                    const reasonMissing = needsReason(
                                        row,
                                        index,
                                    );

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
                                                            0 to {limit.max}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        Cannot issue
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="grid gap-1">
                                                    <Input
                                                        value={row.remarks}
                                                        readOnly={
                                                            limit.available <= 0
                                                        }
                                                        placeholder={
                                                            row.quantity_issued <
                                                            limit.max
                                                                ? 'Why less? e.g. reserved'
                                                                : 'Optional remarks'
                                                        }
                                                        onChange={(e) =>
                                                            updateItem(index, {
                                                                remarks:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        }
                                                        aria-invalid={
                                                            reasonMissing ||
                                                            undefined
                                                        }
                                                        aria-label="Remarks"
                                                    />
                                                    {reasonMissing && (
                                                        <span className="text-xs text-destructive">
                                                            Say why less than{' '}
                                                            {limit.max}.
                                                        </span>
                                                    )}
                                                </div>
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
                    {nothingToIssue && (
                        <p className="text-sm text-destructive">
                            Issue at least one item.
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
                        step="issued"
                        document={{ slip: risSlip }}
                        signature={form.data.signature}
                        onSignatureChange={(signature) =>
                            form.setData('signature', signature)
                        }
                        terms={issueTerms}
                        agreed={agreed}
                        onAgreedChange={setAgreed}
                    />
                    <InputError
                        message={
                            form.errors.signature_type ??
                            signatureError(form.errors)
                        }
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
                            missingReasons > 0 ||
                            nothingToIssue ||
                            (form.data.signature_type === 'esign' && !agreed) ||
                            !signatureReady(
                                form.data.signature_type,
                                form.data.signature,
                            )
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
    const form = useForm<{
        signature_type: SignatureType;
        signature: PlacedSignature | null;
    }>({
        signature_type: 'sgd',
        signature: null,
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
                        step="received"
                        document={{ slip: risSlip }}
                        signature={form.data.signature}
                        onSignatureChange={(signature) =>
                            form.setData('signature', signature)
                        }
                        terms={receiveTerms}
                        agreed={agreed}
                        onAgreedChange={setAgreed}
                    />
                    <InputError
                        message={
                            form.errors.signature_type ??
                            signatureError(form.errors)
                        }
                    />
                    <div>
                        <Button
                            type="submit"
                            disabled={
                                form.processing ||
                                (form.data.signature_type === 'esign' &&
                                    !agreed) ||
                                !signatureReady(
                                    form.data.signature_type,
                                    form.data.signature,
                                )
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
