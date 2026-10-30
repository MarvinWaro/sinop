import { router, useForm } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import { LineItemsToolbar } from '@/components/line-items-toolbar';
import { SearchableSelect } from '@/components/searchable-select';
import type { SearchableOption } from '@/components/searchable-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
    addItemOnEnter,
    stripRowKeys,
    useLineItems,
    withRowKey,
} from '@/hooks/use-line-items';
import type { Keyed } from '@/hooks/use-line-items';
import { formatNumber, todayIso } from '@/lib/format';
import { getJson, postJson } from '@/lib/http';
import { officeOfDivision } from '@/lib/ris';
import {
    next as nextRis,
    storeManual,
    validateManualStock,
} from '@/routes/ris';
import type { Department } from '@/types';

/** Supply option prepared by RisSlipController@index for manual entries. */
export type ManualSupplyOption = {
    supply_id: number;
    display_name: string;
    item_name: string;
    stock_no: string;
    description: string | null;
    unit: string;
    unit_of_measurement: string;
    quantity_on_hand: number;
    actual_available: number;
    pending_requested: number;
    has_stock: boolean;
};

export type ManualUserOption = {
    id: number;
    name: string;
    email: string;
    department_id: number | null;
    department_name?: string;
};

type ManualItem = {
    supply_id: string;
    quantity_requested: number;
    quantity_issued: number;
    remarks: string;
};

type ManualForm = {
    is_manual_entry: boolean;
    ris_date: string;
    reference_no: string;
    entity_name: string;
    division: string;
    office: string;
    fund_cluster: string;
    responsibility_center_code: string;
    requested_by: string;
    purpose: string;
    final_status: '' | 'completed' | 'posted' | 'declined';
    decline_reason: string;
    items: Keyed<ManualItem>[];
};

const emptyItem = (): ManualItem => ({
    supply_id: '',
    quantity_requested: 1,
    quantity_issued: 0,
    remarks: '',
});

function fiveYearsAgo(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    departments: Department[];
    users: ManualUserOption[];
    supplies: ManualSupplyOption[];
    showAllSupplies: boolean;
};

export function ManualEntryDialog({
    open,
    onOpenChange,
    departments,
    users,
    supplies,
    showAllSupplies,
}: Props) {
    const form = useForm<ManualForm>({
        is_manual_entry: true,
        ris_date: '',
        reference_no: '',
        entity_name: 'CHEDRO 12',
        division: '',
        office: '',
        fund_cluster: '',
        responsibility_center_code: '',
        requested_by: '',
        purpose: '',
        final_status: '',
        decline_reason: '',
        items: [withRowKey(emptyItem())],
    });
    const {
        add: addItem,
        update: updateItem,
        remove: removeItem,
        newestKey,
    } = useLineItems<ManualItem, ManualForm>(form.setData, emptyItem);

    // Availability as of the RIS date (receipts minus issues up to that date).
    const [asOfAvailability, setAsOfAvailability] = useState<
        Record<string, number>
    >({});
    const [loadingNumber, setLoadingNumber] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const body = useRef<HTMLDivElement>(null);

    const errors = form.errors as Record<string, string | undefined>;
    const items = form.data.items;

    const selectedKey = items
        .map((item) => item.supply_id)
        .filter(Boolean)
        .join(',');
    const selectedIds = useMemo(
        () => new Set(selectedKey ? selectedKey.split(',') : []),
        [selectedKey],
    );

    useEffect(() => {
        if (!form.data.ris_date || selectedKey === '') {
            return;
        }

        let cancelled = false;

        postJson<{
            success: boolean;
            current_availability: Record<string, number>;
        }>(validateManualStock.url(), {
            ris_date: form.data.ris_date,
            items: selectedKey
                .split(',')
                .map((id) => ({ supply_id: Number(id) })),
        })
            .then((response) => {
                if (!cancelled) {
                    setAsOfAvailability(response.current_availability ?? {});
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setAsOfAvailability({});
                }
            });

        return () => {
            cancelled = true;
        };
    }, [form.data.ris_date, selectedKey]);

    const changeDate = (value: string) => {
        form.setData('ris_date', value);

        if (!value) {
            return;
        }

        setLoadingNumber(true);
        getJson<{ success: boolean; defaultRis?: string }>(nextRis.url(), {
            ris_date: value,
        })
            .then((response) => {
                if (response.success && response.defaultRis) {
                    form.setData('reference_no', response.defaultRis);
                }
            })
            .catch(() => {
                // Leave the RIS number for the user to type in.
            })
            .finally(() => setLoadingNumber(false));
    };

    // Office follows the division ("Scholarship Division - UniFAST BARMM" →
    // "UniFAST BARMM") until someone types their own.
    const changeDivision = (value: string) => {
        const officeOf = (id: string) =>
            officeOfDivision(
                departments.find((d) => String(d.id) === id)?.name,
            );

        form.setData((data) => ({
            ...data,
            division: value,
            office:
                !data.office.trim() || data.office === officeOf(data.division)
                    ? officeOf(value)
                    : data.office,
        }));
    };

    const toggleAllSupplies = (checked: boolean) => {
        router.reload({
            data: { show_all_supplies: checked ? 1 : 0 },
            only: ['availableSupplies', 'showAllSupplies'],
        });
    };

    const close = () => {
        onOpenChange(false);
        form.reset();
        form.clearErrors();
        setAsOfAvailability({});
    };

    // Esc, a click outside, ✕ and Cancel ask first once something was typed.
    const requestClose = () => {
        if (form.isDirty) {
            setConfirmDiscard(true);
        } else {
            close();
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.transform((data) => ({
            ...data,
            items: stripRowKeys(data.items),
        }));
        form.post(storeManual.url(), {
            preserveScroll: true,
            onSuccess: () => close(),
            // The error summary is at the top of the form.
            onError: () =>
                body.current?.scrollTo({ top: 0, behavior: 'smooth' }),
        });
    };

    const supplyOptions = useMemo<SearchableOption[]>(
        () =>
            supplies.map((supply) => ({
                value: String(supply.supply_id),
                label:
                    supply.display_name ??
                    `${supply.item_name} (${supply.stock_no})`,
                description: [
                    supply.description,
                    supply.unit ?? supply.unit_of_measurement,
                ]
                    .filter(Boolean)
                    .join(' · '),
                meta: supply.has_stock
                    ? `${formatNumber(supply.actual_available)} avail.`
                    : 'No stock',
            })),
        [supplies],
    );
    const suppliesById = useMemo(
        () =>
            new Map(
                supplies.map((supply) => [String(supply.supply_id), supply]),
            ),
        [supplies],
    );

    const userOptions = useMemo(
        () =>
            users
                .map((user) => ({
                    value: String(user.id),
                    label: user.name,
                    description: user.email,
                    group: user.department_name ?? 'No Department',
                }))
                .sort(
                    (a, b) =>
                        a.group.localeCompare(b.group) ||
                        a.label.localeCompare(b.label),
                ),
        [users],
    );

    const itemErrors = Object.entries(errors)
        .filter(([key]) => key.startsWith('items.'))
        .map(([key, message]) => {
            const match = /^items\.(\d+)\./.exec(key);

            return `Row ${match ? Number(match[1]) + 1 : '?'}: ${message}`;
        });

    const totalRequested = items.reduce(
        (sum, item) => sum + item.quantity_requested,
        0,
    );
    const totalIssued = items.reduce(
        (sum, item) => sum + item.quantity_issued,
        0,
    );

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(next: boolean) =>
                    next ? onOpenChange(true) : requestClose()
                }
            >
                <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Manual RIS entry</DialogTitle>
                        <DialogDescription>
                            Record a historical requisition and issue slip.
                            Stock is deducted for posted and completed entries.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={submit}
                        className="flex min-h-0 flex-1 flex-col gap-4"
                    >
                        <div
                            ref={body}
                            className="-mx-6 min-h-0 flex-1 space-y-6 overflow-y-auto px-6"
                        >
                            {(errors.stock_validation ||
                                errors.items ||
                                errors.duplicate_items ||
                                itemErrors.length > 0) && (
                                <Alert variant="destructive">
                                    <AlertTitle>
                                        Please fix the following
                                    </AlertTitle>
                                    <AlertDescription>
                                        <ul className="list-disc pl-4">
                                            {errors.stock_validation && (
                                                <li>
                                                    {errors.stock_validation}
                                                </li>
                                            )}
                                            {errors.items && (
                                                <li>{errors.items}</li>
                                            )}
                                            {errors.duplicate_items && (
                                                <li>
                                                    {errors.duplicate_items}
                                                </li>
                                            )}
                                            {itemErrors.map((message) => (
                                                <li key={message}>{message}</li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}

                            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <FormField
                                    label="RIS date"
                                    htmlFor="ris_date"
                                    error={form.errors.ris_date}
                                    required
                                >
                                    <Input
                                        id="ris_date"
                                        type="date"
                                        value={form.data.ris_date}
                                        min={fiveYearsAgo()}
                                        max={todayIso()}
                                        onChange={(e) =>
                                            changeDate(e.target.value)
                                        }
                                        required
                                    />
                                </FormField>
                                <FormField
                                    label="RIS No."
                                    htmlFor="reference_no"
                                    error={form.errors.reference_no}
                                    hint={
                                        loadingNumber
                                            ? 'Getting the next RIS number…'
                                            : 'Filled in from the RIS date; you can change it.'
                                    }
                                >
                                    <Input
                                        id="reference_no"
                                        value={form.data.reference_no}
                                        placeholder="RIS YYYY-MM-XXX"
                                        onChange={(e) =>
                                            form.setData(
                                                'reference_no',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </FormField>
                                <FormField
                                    label="Division"
                                    htmlFor="manual_division"
                                    error={form.errors.division}
                                    required
                                >
                                    <FormSelect
                                        id="manual_division"
                                        value={form.data.division}
                                        onValueChange={(value) =>
                                            changeDivision(value)
                                        }
                                        required
                                        placeholder="Select division"
                                        options={departments.map(
                                            (department) => ({
                                                value: department.id,
                                                label: department.name,
                                            }),
                                        )}
                                    />
                                </FormField>
                                <FormField
                                    label="Fund cluster"
                                    htmlFor="manual_fund_cluster"
                                    error={form.errors.fund_cluster}
                                >
                                    <FormSelect
                                        id="manual_fund_cluster"
                                        value={form.data.fund_cluster}
                                        onValueChange={(value) =>
                                            form.setData('fund_cluster', value)
                                        }
                                        options={[
                                            {
                                                value: '',
                                                label: 'Select fund cluster',
                                            },
                                            { value: '101', label: '101' },
                                            { value: '151', label: '151' },
                                        ]}
                                    />
                                </FormField>
                                <FormField
                                    label="Entity name"
                                    htmlFor="manual_entity_name"
                                    error={form.errors.entity_name}
                                    required
                                >
                                    <Input
                                        id="manual_entity_name"
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
                                    label="Office"
                                    htmlFor="manual_office"
                                    error={form.errors.office}
                                >
                                    <Input
                                        id="manual_office"
                                        value={form.data.office}
                                        onChange={(e) =>
                                            form.setData(
                                                'office',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </FormField>
                                <FormField
                                    label="Responsibility center code"
                                    htmlFor="manual_rcc"
                                    error={
                                        form.errors.responsibility_center_code
                                    }
                                >
                                    <Input
                                        id="manual_rcc"
                                        value={
                                            form.data.responsibility_center_code
                                        }
                                        onChange={(e) =>
                                            form.setData(
                                                'responsibility_center_code',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </FormField>
                                <FormField
                                    label="Requested by"
                                    htmlFor="manual_requested_by"
                                    error={form.errors.requested_by}
                                    required
                                >
                                    <SearchableSelect
                                        id="manual_requested_by"
                                        options={userOptions}
                                        value={form.data.requested_by}
                                        onChange={(value) =>
                                            form.setData('requested_by', value)
                                        }
                                        placeholder="Select user"
                                        searchPlaceholder="Search users..."
                                        invalid={Boolean(
                                            form.errors.requested_by,
                                        )}
                                    />
                                </FormField>
                                <FormField
                                    label="Purpose"
                                    htmlFor="manual_purpose"
                                    error={form.errors.purpose}
                                    className="md:col-span-2 lg:col-span-4"
                                >
                                    <Textarea
                                        id="manual_purpose"
                                        rows={2}
                                        value={form.data.purpose}
                                        onChange={(e) =>
                                            form.setData(
                                                'purpose',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Optional: the purpose of this requisition"
                                    />
                                </FormField>
                            </section>

                            <section className="space-y-3">
                                <LineItemsToolbar
                                    count={items.length}
                                    onAdd={addItem}
                                    description={
                                        showAllSupplies
                                            ? 'Showing all active supplies. Newest item on top.'
                                            : 'Only supplies with available stock are shown. Newest item on top.'
                                    }
                                >
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="show_all_supplies"
                                            checked={showAllSupplies}
                                            onCheckedChange={(
                                                checked:
                                                    | boolean
                                                    | 'indeterminate',
                                            ) =>
                                                toggleAllSupplies(
                                                    checked === true,
                                                )
                                            }
                                        />
                                        <Label
                                            htmlFor="show_all_supplies"
                                            className="font-normal"
                                        >
                                            Show all supplies
                                        </Label>
                                    </div>
                                </LineItemsToolbar>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-10">
                                                    #
                                                </TableHead>
                                                <TableHead className="min-w-72">
                                                    Supply item
                                                </TableHead>
                                                <TableHead className="w-32 text-right">
                                                    Available
                                                </TableHead>
                                                <TableHead className="w-28">
                                                    Requested
                                                </TableHead>
                                                <TableHead className="w-28">
                                                    Issued
                                                </TableHead>
                                                <TableHead className="w-48">
                                                    Remarks
                                                </TableHead>
                                                <TableHead className="w-12" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={7}
                                                        className="py-8 text-center text-sm text-muted-foreground"
                                                    >
                                                        No items added yet.
                                                        Click &quot;Add
                                                        item&quot; to start.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                // Newest first; the data
                                                // keeps the entry order.
                                                items
                                                    .map((item, index) => (
                                                        <ManualItemRow
                                                            key={item.row_key}
                                                            item={item}
                                                            index={index}
                                                            supply={suppliesById.get(
                                                                item.supply_id,
                                                            )}
                                                            asOf={
                                                                item.supply_id
                                                                    ? asOfAvailability[
                                                                          item
                                                                              .supply_id
                                                                      ]
                                                                    : undefined
                                                            }
                                                            supplyOptions={
                                                                supplyOptions
                                                            }
                                                            selectedIds={
                                                                selectedIds
                                                            }
                                                            supplyInvalid={Boolean(
                                                                errors[
                                                                    `items.${index}.supply_id`
                                                                ],
                                                            )}
                                                            requestedInvalid={Boolean(
                                                                errors[
                                                                    `items.${index}.quantity_requested`
                                                                ],
                                                            )}
                                                            issuedInvalid={Boolean(
                                                                errors[
                                                                    `items.${index}.quantity_issued`
                                                                ],
                                                            )}
                                                            isNewest={
                                                                item.row_key ===
                                                                newestKey
                                                            }
                                                            onChange={
                                                                updateItem
                                                            }
                                                            onRemove={
                                                                removeItem
                                                            }
                                                            onAddNext={addItem}
                                                        />
                                                    ))
                                                    .reverse()
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>
                        </div>

                        <DialogFooter className="flex-col border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="grid gap-3 sm:flex sm:items-start">
                                <FormField
                                    label="Final status"
                                    htmlFor="final_status"
                                    error={form.errors.final_status}
                                    required
                                    hint={
                                        form.data.final_status === 'completed'
                                            ? 'Approved by the current CAO, issued by you, received by the requester.'
                                            : undefined
                                    }
                                    className="sm:w-64"
                                >
                                    <FormSelect
                                        id="final_status"
                                        value={form.data.final_status}
                                        onValueChange={(value) =>
                                            form.setData(
                                                'final_status',
                                                value as ManualForm['final_status'],
                                            )
                                        }
                                        required
                                        placeholder="Select status"
                                        options={[
                                            {
                                                value: 'completed',
                                                label: 'Completed (fully processed)',
                                            },
                                            {
                                                value: 'posted',
                                                label: 'Issued (pending receipt)',
                                            },
                                            {
                                                value: 'declined',
                                                label: 'Declined',
                                            },
                                        ]}
                                    />
                                </FormField>
                                {form.data.final_status === 'declined' && (
                                    <FormField
                                        label="Decline reason"
                                        htmlFor="decline_reason"
                                        error={form.errors.decline_reason}
                                        required
                                        className="sm:w-72"
                                    >
                                        <Input
                                            id="decline_reason"
                                            value={form.data.decline_reason}
                                            onChange={(e) =>
                                                form.setData(
                                                    'decline_reason',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </FormField>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 sm:items-end">
                                <p className="text-sm text-muted-foreground tabular-nums">
                                    {items.length}{' '}
                                    {items.length === 1 ? 'item' : 'items'} ·{' '}
                                    {formatNumber(totalRequested)} requested ·{' '}
                                    {formatNumber(totalIssued)} issued
                                </p>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={requestClose}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={form.processing}
                                    >
                                        Create manual RIS
                                    </Button>
                                </div>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={confirmDiscard}
                onOpenChange={setConfirmDiscard}
                title="Discard this manual RIS?"
                description="The details and items you entered will be cleared."
                confirmLabel="Discard"
                cancelLabel="Keep editing"
                destructive
                onConfirm={() => {
                    setConfirmDiscard(false);
                    close();
                }}
            />
        </>
    );
}

type ManualItemRowProps = {
    item: Keyed<ManualItem>;
    index: number;
    supply: ManualSupplyOption | undefined;
    /** Availability as of the RIS date, once loaded. */
    asOf: number | undefined;
    supplyOptions: SearchableOption[];
    selectedIds: ReadonlySet<string>;
    supplyInvalid: boolean;
    requestedInvalid: boolean;
    issuedInvalid: boolean;
    /** The row added last: scroll to it and open its supply list. */
    isNewest: boolean;
    onChange: (index: number, patch: Partial<ManualItem>) => void;
    onRemove: (index: number) => void;
    onAddNext: () => void;
};

/** One supply line; re-renders only when its own props change. */
const ManualItemRow = memo(function ManualItemRow({
    item,
    index,
    supply,
    asOf,
    supplyOptions,
    selectedIds,
    supplyInvalid,
    requestedInvalid,
    issuedInvalid,
    isNewest,
    onChange,
    onRemove,
    onAddNext,
}: ManualItemRowProps) {
    const row = useRef<HTMLTableRowElement>(null);

    // A supply already on another line can't be picked twice.
    const options = useMemo(
        () =>
            supplyOptions.map((option) => ({
                ...option,
                disabled:
                    option.value !== item.supply_id &&
                    selectedIds.has(option.value),
            })),
        [supplyOptions, selectedIds, item.supply_id],
    );

    useEffect(() => {
        if (isNewest) {
            row.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [isNewest]);

    return (
        <TableRow
            ref={row}
            className="scroll-mt-24 align-top"
            onKeyDown={addItemOnEnter(onAddNext)}
        >
            <TableCell className="pt-4 text-muted-foreground tabular-nums">
                {index + 1}
            </TableCell>
            <TableCell className="whitespace-normal">
                <SearchableSelect
                    options={options}
                    value={item.supply_id}
                    onChange={(value) => onChange(index, { supply_id: value })}
                    placeholder="Select supply"
                    searchPlaceholder="Search supplies..."
                    invalid={supplyInvalid}
                    defaultOpen={isNewest}
                />
            </TableCell>
            <TableCell className="text-right text-sm">
                {supply ? (
                    <div className="flex flex-col items-end">
                        <span className="font-medium">
                            {formatNumber(supply.actual_available)}{' '}
                            {supply.unit}
                        </span>
                        {asOf !== undefined && (
                            <span className="text-xs text-muted-foreground">
                                {formatNumber(asOf)} as of date
                            </span>
                        )}
                    </div>
                ) : (
                    <span className="text-muted-foreground">—</span>
                )}
            </TableCell>
            <TableCell>
                <Input
                    type="number"
                    min={1}
                    value={item.quantity_requested}
                    onChange={(e) =>
                        onChange(index, {
                            quantity_requested:
                                parseInt(e.target.value, 10) || 0,
                        })
                    }
                    aria-label="Quantity requested"
                    aria-invalid={requestedInvalid || undefined}
                />
            </TableCell>
            <TableCell>
                <Input
                    type="number"
                    min={0}
                    value={item.quantity_issued}
                    onChange={(e) =>
                        onChange(index, {
                            quantity_issued: parseInt(e.target.value, 10) || 0,
                        })
                    }
                    aria-label="Quantity issued"
                    aria-invalid={issuedInvalid || undefined}
                />
            </TableCell>
            <TableCell>
                <Input
                    value={item.remarks}
                    onChange={(e) =>
                        onChange(index, { remarks: e.target.value })
                    }
                    aria-label="Remarks"
                />
            </TableCell>
            <TableCell>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove item ${index + 1}`}
                >
                    <Trash2 />
                </Button>
            </TableCell>
        </TableRow>
    );
});
