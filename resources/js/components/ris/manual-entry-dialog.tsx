import { router, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import InputError from '@/components/input-error';
import { SearchableSelect } from '@/components/searchable-select';
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
import { formatNumber, todayIso } from '@/lib/format';
import { getJson, postJson } from '@/lib/http';
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
    items: ManualItem[];
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
        items: [emptyItem()],
    });

    // Availability as of the RIS date (receipts minus issues up to that date).
    const [asOfAvailability, setAsOfAvailability] = useState<
        Record<string, number>
    >({});
    const [loadingNumber, setLoadingNumber] = useState(false);

    const errors = form.errors as Record<string, string | undefined>;

    const selectedIds = form.data.items
        .map((item) => item.supply_id)
        .filter(Boolean);
    const selectedKey = selectedIds.join(',');

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

    const changeDivision = (value: string) => {
        const department = departments.find((d) => String(d.id) === value);
        form.setData((data) => ({
            ...data,
            division: value,
            office: department?.name ?? data.office,
        }));
    };

    const updateItem = (index: number, patch: Partial<ManualItem>) => {
        form.setData(
            'items',
            form.data.items.map((item, i) =>
                i === index ? { ...item, ...patch } : item,
            ),
        );
    };

    const removeItem = (index: number) => {
        form.setData(
            'items',
            form.data.items.filter((_, i) => i !== index),
        );
    };

    const toggleAllSupplies = (checked: boolean) => {
        router.reload({
            data: { show_all_supplies: checked ? 1 : 0 },
            only: ['availableSupplies', 'showAllSupplies'],
        });
    };

    const close = (value: boolean) => {
        onOpenChange(value);

        if (!value) {
            form.reset();
            form.clearErrors();
            setAsOfAvailability({});
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.post(storeManual.url(), {
            preserveScroll: true,
            onSuccess: () => close(false),
        });
    };

    const supplyOptions = (currentId: string) =>
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
            disabled:
                String(supply.supply_id) !== currentId &&
                selectedIds.includes(String(supply.supply_id)),
        }));

    const userOptions = users.map((user) => ({
        value: String(user.id),
        label: user.name,
        description: user.email,
        group: user.department_name ?? 'No Department',
    }));
    userOptions.sort(
        (a, b) =>
            (a.group ?? '').localeCompare(b.group ?? '') ||
            a.label.localeCompare(b.label),
    );

    const itemErrors = Object.entries(errors)
        .filter(([key]) => key.startsWith('items.'))
        .map(([key, message]) => {
            const match = /^items\.(\d+)\./.exec(key);

            return `Row ${match ? Number(match[1]) + 1 : '?'}: ${message}`;
        });

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Manual RIS entry</DialogTitle>
                    <DialogDescription>
                        Record a historical requisition and issue slip. Stock is
                        deducted for posted and completed entries.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="manual-ris-form"
                    onSubmit={submit}
                    className="-mx-6 flex-1 space-y-6 overflow-y-auto px-6"
                >
                    {(errors.stock_validation ||
                        errors.items ||
                        itemErrors.length > 0) && (
                        <Alert variant="destructive">
                            <AlertTitle>Please fix the following</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc pl-4">
                                    {errors.stock_validation && (
                                        <li>{errors.stock_validation}</li>
                                    )}
                                    {errors.items && <li>{errors.items}</li>}
                                    {itemErrors.map((message) => (
                                        <li key={message}>{message}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    <section className="grid gap-4 md:grid-cols-2">
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
                                onChange={(e) => changeDate(e.target.value)}
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
                                    form.setData('reference_no', e.target.value)
                                }
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
                                    form.setData('entity_name', e.target.value)
                                }
                                required
                            />
                        </FormField>
                        <FormField
                            label="Division"
                            htmlFor="manual_division"
                            error={form.errors.division}
                            required
                        >
                            <NativeSelect
                                id="manual_division"
                                value={form.data.division}
                                onChange={(e) => changeDivision(e.target.value)}
                                required
                            >
                                <option value="">Select division</option>
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
                            label="Fund cluster"
                            htmlFor="manual_fund_cluster"
                            error={form.errors.fund_cluster}
                        >
                            <NativeSelect
                                id="manual_fund_cluster"
                                value={form.data.fund_cluster}
                                onChange={(e) =>
                                    form.setData('fund_cluster', e.target.value)
                                }
                            >
                                <option value="">Select fund cluster</option>
                                <option value="101">101</option>
                                <option value="151">151</option>
                            </NativeSelect>
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
                                    form.setData('office', e.target.value)
                                }
                            />
                        </FormField>
                        <FormField
                            label="Responsibility center code"
                            htmlFor="manual_rcc"
                            error={form.errors.responsibility_center_code}
                        >
                            <Input
                                id="manual_rcc"
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
                                invalid={Boolean(form.errors.requested_by)}
                            />
                        </FormField>
                        <FormField
                            label="Purpose"
                            htmlFor="manual_purpose"
                            error={form.errors.purpose}
                            required
                            className="md:col-span-2"
                        >
                            <Textarea
                                id="manual_purpose"
                                rows={3}
                                value={form.data.purpose}
                                onChange={(e) =>
                                    form.setData('purpose', e.target.value)
                                }
                                placeholder="Enter the purpose of this requisition..."
                                required
                            />
                        </FormField>
                    </section>

                    <section className="space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="font-medium">Supply items</h3>
                                <p className="text-sm text-muted-foreground">
                                    {showAllSupplies
                                        ? 'Showing all active supplies.'
                                        : 'Only supplies with available stock are shown.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="show_all_supplies"
                                        checked={showAllSupplies}
                                        onCheckedChange={(
                                            checked: boolean | 'indeterminate',
                                        ) =>
                                            toggleAllSupplies(checked === true)
                                        }
                                    />
                                    <Label
                                        htmlFor="show_all_supplies"
                                        className="font-normal"
                                    >
                                        Show all supplies
                                    </Label>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        form.setData('items', [
                                            ...form.data.items,
                                            emptyItem(),
                                        ])
                                    }
                                >
                                    <Plus />
                                    Add item
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
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
                                    {form.data.items.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                className="py-8 text-center text-sm text-muted-foreground"
                                            >
                                                No items added yet. Click
                                                &quot;Add item&quot; to start.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        form.data.items.map((item, index) => {
                                            const supply = supplies.find(
                                                (s) =>
                                                    String(s.supply_id) ===
                                                    item.supply_id,
                                            );
                                            const asOf = item.supply_id
                                                ? asOfAvailability[
                                                      item.supply_id
                                                  ]
                                                : undefined;

                                            return (
                                                <TableRow
                                                    key={index}
                                                    className="align-top"
                                                >
                                                    <TableCell className="whitespace-normal">
                                                        <SearchableSelect
                                                            options={supplyOptions(
                                                                item.supply_id,
                                                            )}
                                                            value={
                                                                item.supply_id
                                                            }
                                                            onChange={(value) =>
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        supply_id:
                                                                            value,
                                                                    },
                                                                )
                                                            }
                                                            placeholder="Select supply"
                                                            searchPlaceholder="Search supplies..."
                                                            invalid={Boolean(
                                                                errors[
                                                                    `items.${index}.supply_id`
                                                                ],
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        {supply ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-medium">
                                                                    {formatNumber(
                                                                        supply.actual_available,
                                                                    )}{' '}
                                                                    {
                                                                        supply.unit
                                                                    }
                                                                </span>
                                                                {asOf !==
                                                                    undefined && (
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatNumber(
                                                                            asOf,
                                                                        )}{' '}
                                                                        as of
                                                                        date
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={
                                                                item.quantity_requested
                                                            }
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        quantity_requested:
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
                                                            aria-label="Quantity requested"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={
                                                                item.quantity_issued
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
                                                            aria-label="Quantity issued"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={item.remarks}
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        remarks:
                                                                            e
                                                                                .target
                                                                                .value,
                                                                    },
                                                                )
                                                            }
                                                            aria-label="Remarks"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                removeItem(
                                                                    index,
                                                                )
                                                            }
                                                            aria-label="Remove item"
                                                        >
                                                            <Trash2 />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </section>

                    <section className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                        <FormField
                            label="Final status"
                            htmlFor="final_status"
                            error={form.errors.final_status}
                            required
                        >
                            <NativeSelect
                                id="final_status"
                                value={form.data.final_status}
                                onChange={(e) =>
                                    form.setData(
                                        'final_status',
                                        e.target
                                            .value as ManualForm['final_status'],
                                    )
                                }
                                required
                            >
                                <option value="">Select status</option>
                                <option value="completed">
                                    Completed (fully processed)
                                </option>
                                <option value="posted">
                                    Issued (pending receipt)
                                </option>
                                <option value="declined">Declined</option>
                            </NativeSelect>
                        </FormField>
                        {form.data.final_status === 'declined' && (
                            <FormField
                                label="Decline reason"
                                htmlFor="decline_reason"
                                error={form.errors.decline_reason}
                                required
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
                        {form.data.final_status === 'completed' && (
                            <div className="text-sm text-muted-foreground md:col-span-2">
                                <p className="font-medium text-foreground">
                                    Completed status
                                </p>
                                <p>
                                    Approved by: the current CAO · Issued by:
                                    you · Received by: the requester
                                </p>
                            </div>
                        )}
                        <InputError
                            message={errors.duplicate_items}
                            className="md:col-span-2"
                        />
                    </section>
                </form>

                <DialogFooter className="border-t pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => close(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="manual-ris-form"
                        disabled={form.processing}
                    >
                        Create manual RIS
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
