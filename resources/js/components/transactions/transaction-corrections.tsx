import { useForm } from '@inertiajs/react';
import { Info } from 'lucide-react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import InputError from '@/components/input-error';
import { TransactionTypeBadge } from '@/components/status-badges';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatMoney, formatNumber, todayIso } from '@/lib/format';
import {
    destroy as destroyRoute,
    renumber as renumberRoute,
    update as updateRoute,
} from '@/routes/supply-transactions';
import type { TransactionLine } from '@/types';

/**
 * Admin corrections on the Transactions page: edit a receipt or issue line,
 * delete one, or renumber a whole IAR. The server keeps the stock on hand,
 * later balances and the RIS in step (App\Actions\Transactions\*), and
 * logs each with its reason.
 */

/** Receipts and issues can be corrected; re-value lines can't. */
export const isCorrectable = (
    line: Pick<TransactionLine, 'transaction_type'>,
) => line.transaction_type === 'receipt' || line.transaction_type === 'issue';

const lineTitle = (line: TransactionLine) =>
    `${line.supply?.item_name ?? 'Item'} · ${line.reference_no ?? `#${line.transaction_id}`}`;

function ReasonField({
    value,
    onChange,
    error,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    placeholder: string;
}) {
    return (
        <FormField
            label="Reason"
            htmlFor="correction-reason"
            error={error}
            hint="Kept in the activity log with the before and after values."
            required
        >
            <Textarea
                id="correction-reason"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                maxLength={500}
                rows={2}
                aria-invalid={!!error}
            />
        </FormField>
    );
}

export function CorrectTransactionDialog({
    line,
    divisions,
    onClose,
}: {
    line: TransactionLine | null;
    divisions: { id: number; name: string }[];
    onClose: () => void;
}) {
    return (
        <Dialog
            open={line !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-lg">
                {line && (
                    <CorrectForm
                        key={line.transaction_id}
                        line={line}
                        divisions={divisions}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function CorrectForm({
    line,
    divisions,
    onClose,
}: {
    line: TransactionLine;
    divisions: { id: number; name: string }[];
    onClose: () => void;
}) {
    const receipt = line.transaction_type === 'receipt';
    const unit = line.supply?.unit_of_measurement ?? '';
    const form = useForm({
        transaction_date: line.transaction_date,
        reference_no: line.reference_no ?? '',
        quantity: String(line.quantity),
        unit_cost: String(Number(line.unit_cost)),
        department_id: line.department?.id ? String(line.department.id) : '',
        remarks: line.remarks ?? '',
        reason: '',
    });

    const quantity = Number(form.data.quantity) || 0;
    const unitCost = receipt
        ? Number(form.data.unit_cost) || 0
        : Number(line.unit_cost);
    const quantityChanged = quantity !== line.quantity;
    const totalBefore = Number(line.total_cost);
    const totalAfter = quantity * unitCost;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) =>
            receipt
                ? { ...data, department_id: undefined }
                : { ...data, reference_no: undefined, unit_cost: undefined },
        );
        form.put(updateRoute.url(line.transaction_id), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <form onSubmit={submit} className="grid gap-5">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    Correct transaction #{line.transaction_id}
                    <TransactionTypeBadge type={line.transaction_type} />
                </DialogTitle>
                <DialogDescription>{lineTitle(line)}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                    label="Date"
                    htmlFor="correction-date"
                    error={form.errors.transaction_date}
                    required
                >
                    <Input
                        id="correction-date"
                        type="date"
                        max={todayIso()}
                        value={form.data.transaction_date}
                        onChange={(event) =>
                            form.setData('transaction_date', event.target.value)
                        }
                    />
                </FormField>
                {receipt ? (
                    <FormField
                        label="IAR no."
                        htmlFor="correction-reference"
                        error={form.errors.reference_no}
                        required
                    >
                        <Input
                            id="correction-reference"
                            value={form.data.reference_no}
                            onChange={(event) =>
                                form.setData(
                                    'reference_no',
                                    event.target.value.toUpperCase(),
                                )
                            }
                            placeholder="IAR 2026-03-009"
                        />
                    </FormField>
                ) : (
                    <FormField
                        label="Division"
                        htmlFor="correction-division"
                        error={form.errors.department_id}
                    >
                        <FormSelect
                            id="correction-division"
                            value={form.data.department_id}
                            onValueChange={(value) =>
                                form.setData('department_id', value)
                            }
                            options={[
                                { value: '', label: 'No division' },
                                ...divisions.map((division) => ({
                                    value: String(division.id),
                                    label: division.name,
                                })),
                            ]}
                        />
                    </FormField>
                )}
                <FormField
                    label={`Quantity${unit ? ` (${unit})` : ''}`}
                    htmlFor="correction-quantity"
                    error={form.errors.quantity}
                    required
                >
                    <Input
                        id="correction-quantity"
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={form.data.quantity}
                        onChange={(event) =>
                            form.setData('quantity', event.target.value)
                        }
                    />
                </FormField>
                {receipt && (
                    <FormField
                        label="Unit cost (₱)"
                        htmlFor="correction-cost"
                        error={form.errors.unit_cost}
                        required
                    >
                        <Input
                            id="correction-cost"
                            type="number"
                            min={0}
                            step="0.01"
                            inputMode="decimal"
                            value={form.data.unit_cost}
                            onChange={(event) =>
                                form.setData('unit_cost', event.target.value)
                            }
                        />
                    </FormField>
                )}
                <FormField
                    label="Remarks"
                    htmlFor="correction-remarks"
                    error={form.errors.remarks}
                    className="sm:col-span-2"
                >
                    <Input
                        id="correction-remarks"
                        value={form.data.remarks}
                        maxLength={255}
                        onChange={(event) =>
                            form.setData('remarks', event.target.value)
                        }
                    />
                </FormField>
            </div>

            <div className="grid gap-1.5 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
                {(quantityChanged || totalAfter !== totalBefore) && (
                    <p className="tabular-nums">
                        {quantityChanged && (
                            <>
                                Quantity{' '}
                                <span className="text-muted-foreground line-through">
                                    {formatNumber(line.quantity)}
                                </span>{' '}
                                →{' '}
                                <span className="font-medium">
                                    {formatNumber(quantity)}
                                </span>
                                {' · '}
                            </>
                        )}
                        Total{' '}
                        <span className="text-muted-foreground line-through">
                            ₱{formatMoney(totalBefore, 2)}
                        </span>{' '}
                        →{' '}
                        <span className="font-medium">
                            ₱{formatMoney(totalAfter, 2)}
                        </span>
                    </p>
                )}
                <p className="flex gap-2 text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>
                        {receipt
                            ? 'The stock on hand and its value, the stock card, the ledger card, RSMI and RPCI follow.'
                            : `The stock on hand, the stock card and the reports follow${line.reference_no?.startsWith('RIS') ? `, and ${line.reference_no}'s issued quantity is corrected too` : ''}.`}
                    </span>
                </p>
            </div>

            <ReasonField
                value={form.data.reason}
                onChange={(value) => form.setData('reason', value)}
                error={form.errors.reason}
                placeholder="e.g. Typed 50 instead of 5"
            />

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={
                        form.processing || form.data.reason.trim().length < 5
                    }
                >
                    {form.processing && <Spinner />}
                    Save correction
                </Button>
            </DialogFooter>
        </form>
    );
}

export function DeleteTransactionDialog({
    line,
    onClose,
}: {
    line: TransactionLine | null;
    onClose: () => void;
}) {
    const form = useForm({ reason: '' });
    const firstError = Object.values(form.errors)[0];

    const close = () => {
        form.reset();
        form.clearErrors();
        onClose();
    };

    return (
        <ConfirmDialog
            open={line !== null}
            onOpenChange={(open) => !open && close()}
            title={`Delete transaction #${line?.transaction_id ?? ''}?`}
            description={
                line && (
                    <>
                        {lineTitle(line)} ·{' '}
                        {line.transaction_type === 'receipt' ? '+' : '−'}
                        {formatNumber(line.quantity)}{' '}
                        {line.supply?.unit_of_measurement} on{' '}
                        {formatDate(line.transaction_date)}.{' '}
                        {line.transaction_type === 'receipt'
                            ? 'The quantity comes off the stock on hand.'
                            : 'The quantity goes back into the stock on hand, and the RIS issued quantity is lowered.'}
                    </>
                )
            }
            confirmLabel="Delete transaction"
            destructive
            processing={form.processing}
            onConfirm={() =>
                line &&
                form.delete(destroyRoute.url(line.transaction_id), {
                    preserveScroll: true,
                    onSuccess: () => close(),
                })
            }
        >
            <ReasonField
                value={form.data.reason}
                onChange={(value) => form.setData('reason', value)}
                error={form.errors.reason}
                placeholder="e.g. Recorded twice"
            />
            {firstError && firstError !== form.errors.reason && (
                <InputError message={firstError} />
            )}
        </ConfirmDialog>
    );
}

export function RenumberIarDialog({
    reference,
    onClose,
}: {
    reference: string | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={reference !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="sm:max-w-md">
                {reference && (
                    <RenumberForm
                        key={reference}
                        reference={reference}
                        onClose={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function RenumberForm({
    reference,
    onClose,
}: {
    reference: string;
    onClose: () => void;
}) {
    const form = useForm({ from: reference, to: reference, reason: '' });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.put(renumberRoute.url(), {
            preserveScroll: true,
            onSuccess: () => onClose(),
        });
    };

    return (
        <form onSubmit={submit} className="grid gap-5">
            <DialogHeader>
                <DialogTitle>Change IAR no.</DialogTitle>
                <DialogDescription>
                    Every item line of {reference} moves to the new number.
                    Quantities and costs don't change.
                </DialogDescription>
            </DialogHeader>
            <FormField
                label="New IAR no."
                htmlFor="renumber-to"
                error={form.errors.to ?? form.errors.from}
                required
            >
                <Input
                    id="renumber-to"
                    value={form.data.to}
                    onChange={(event) =>
                        form.setData('to', event.target.value.toUpperCase())
                    }
                    placeholder="IAR 2026-03-009"
                    autoFocus
                />
            </FormField>
            <ReasonField
                value={form.data.reason}
                onChange={(value) => form.setData('reason', value)}
                error={form.errors.reason}
                placeholder="e.g. Encoded as 008, should be 009"
            />
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    disabled={
                        form.processing ||
                        form.data.to.trim() === reference ||
                        form.data.reason.trim().length < 5
                    }
                >
                    {form.processing && <Spinner />}
                    Change number
                </Button>
            </DialogFooter>
        </form>
    );
}
