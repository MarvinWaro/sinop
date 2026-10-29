import { Link, useForm } from '@inertiajs/react';
import { ImagePlus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { FormField } from '@/components/form-field';
import { SearchableSelect } from '@/components/searchable-select';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { formatMoney, toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index as propertiesIndex, store, update } from '@/routes/property';
import type { Location, Property, UserOption } from '@/types';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const FUNDS = ['Fund 101', 'Fund 151'];
const CONDITIONS = ['Serviceable', 'Unserviceable'];

type Props = {
    property?: Property | null;
    locations: Location[];
    users: UserOption[];
};

type PropertyFormData = {
    property_number: string;
    item_name: string;
    item_description: string;
    serial_no: string;
    model_no: string;
    acquisition_date: string;
    acquisition_cost: string;
    unit_of_measure: string;
    quantity_per_physical_count: string;
    fund: string;
    location_id: string;
    user_id: string;
    condition: string;
    remarks: string;
    images: File[];
    remove_existing_images: '0' | '1';
    _method?: 'put';
};

/** "45000" -> "45,000.00"; keeps empty values empty. */
function formatCost(value: string | null | undefined): string {
    if (value === null || value === undefined || value.trim() === '') {
        return '';
    }

    return formatMoney(toNumber(value), 2);
}

/** Create / edit form for a property (multipart, max 4 images). */
export function PropertyForm({ property = null, locations, users }: Props) {
    const editing = property !== null;
    const form = useForm<PropertyFormData>({
        property_number: property?.property_number ?? '',
        item_name: property?.item_name ?? '',
        item_description: property?.item_description ?? '',
        serial_no: property?.serial_no ?? '',
        model_no: property?.model_no ?? '',
        acquisition_date: property?.acquisition_date?.slice(0, 10) ?? '',
        acquisition_cost: formatCost(property?.acquisition_cost),
        unit_of_measure: property?.unit_of_measure ?? '',
        quantity_per_physical_count: String(
            property?.quantity_per_physical_count ?? 1,
        ),
        fund: property?.fund ?? '',
        location_id: property?.location_id ? String(property.location_id) : '',
        user_id: property?.user_id ? String(property.user_id) : '',
        condition: property?.condition ?? '',
        remarks: property?.remarks ?? '',
        images: [],
        remove_existing_images: '0',
        ...(editing ? { _method: 'put' as const } : {}),
    });

    const fileInput = useRef<HTMLInputElement>(null);
    const [previews, setPreviews] = useState<string[]>([]);
    const [imageError, setImageError] = useState<string | null>(null);
    const previewsRef = useRef<string[]>([]);

    useEffect(
        () => () =>
            previewsRef.current.forEach((url) => URL.revokeObjectURL(url)),
        [],
    );

    const replacePreviews = (files: File[]) => {
        previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
        const urls = files.map((file) => URL.createObjectURL(file));
        previewsRef.current = urls;
        setPreviews(urls);
    };

    const existingImages =
        editing && form.data.remove_existing_images === '0'
            ? (property?.images ?? [])
            : [];

    const onFilesChosen = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        setImageError(null);

        if (files.length > MAX_IMAGES) {
            setImageError(`You can upload a maximum of ${MAX_IMAGES} images.`);
            event.target.value = '';

            return;
        }

        const tooLarge = files.find((file) => file.size > MAX_IMAGE_BYTES);

        if (tooLarge) {
            setImageError(`“${tooLarge.name}” is larger than 25 MB.`);
            event.target.value = '';

            return;
        }

        form.setData('images', files);
        replacePreviews(files);
    };

    const clearImages = () => {
        form.setData((data) => ({
            ...data,
            images: [],
            remove_existing_images: editing ? '1' : '0',
        }));
        replacePreviews([]);
        setImageError(null);

        if (fileInput.current) {
            fileInput.current.value = '';
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (property) {
            form.post(update.url(property.id), {
                forceFormData: true,
                preserveScroll: true,
            });
        } else {
            form.post(store.url(), {
                forceFormData: true,
                preserveScroll: true,
            });
        }
    };

    const fundOptions =
        form.data.fund && !FUNDS.includes(form.data.fund)
            ? [form.data.fund, ...FUNDS]
            : FUNDS;
    const conditionOptions =
        form.data.condition && !CONDITIONS.includes(form.data.condition)
            ? [form.data.condition, ...CONDITIONS]
            : CONDITIONS;

    const locationOptions = locations.map((location) => ({
        value: String(location.id),
        label: location.location_name,
    }));
    const userOptions = [...users]
        .sort((a, b) => Number(b.status) - Number(a.status))
        .map((user) => ({
            value: String(user.id),
            label: user.status ? user.name : `${user.name} (Inactive)`,
            description:
                [user.designation, user.department]
                    .filter(Boolean)
                    .join(' · ') || null,
            disabled: !user.status && String(user.id) !== form.data.user_id,
        }));

    const imageErrors = Object.entries(form.errors)
        .filter(([key]) => key === 'images' || key.startsWith('images.'))
        .map(([, message]) => message);
    const hasImages = previews.length > 0 || existingImages.length > 0;

    return (
        <form
            onSubmit={submit}
            className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]"
        >
            <Card className="h-fit">
                <CardHeader>
                    <CardTitle>Photos</CardTitle>
                    <CardDescription>
                        Up to {MAX_IMAGES} pictures, PNG or JPG, 25 MB each.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                    <label
                        htmlFor="images"
                        className={cn(
                            'flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50',
                            hasImages && 'p-2',
                        )}
                    >
                        {hasImages ? (
                            <div
                                className={cn(
                                    'grid w-full gap-2',
                                    (previews.length || existingImages.length) >
                                        1 && 'grid-cols-2',
                                )}
                            >
                                {(previews.length > 0
                                    ? previews
                                    : existingImages.map((image) => image.url)
                                ).map((src) => (
                                    <img
                                        key={src}
                                        src={src}
                                        alt=""
                                        className="aspect-square w-full rounded-md object-cover"
                                    />
                                ))}
                            </div>
                        ) : (
                            <>
                                <ImagePlus className="size-8" />
                                <span className="font-medium text-foreground">
                                    Click to upload
                                </span>
                                <span>
                                    You can upload a maximum of {MAX_IMAGES}{' '}
                                    pictures
                                </span>
                            </>
                        )}
                        <input
                            ref={fileInput}
                            id="images"
                            type="file"
                            accept="image/*"
                            multiple
                            className="sr-only"
                            onChange={onFilesChosen}
                        />
                    </label>
                    {previews.length > 0 && existingImages.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            New photos are added to the existing ones.
                        </p>
                    )}
                    {editing && form.data.remove_existing_images === '1' && (
                        <p className="text-xs text-muted-foreground">
                            Existing photos will be removed when you save.
                        </p>
                    )}
                    {(imageError || imageErrors.length > 0) && (
                        <p className="text-sm text-destructive">
                            {imageError ?? imageErrors[0]}
                        </p>
                    )}
                    {hasImages && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearImages}
                        >
                            <X />
                            Remove images
                        </Button>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Property details</CardTitle>
                    <CardDescription>
                        Fields marked * are required.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        label="Item name"
                        htmlFor="item_name"
                        error={form.errors.item_name}
                        required
                    >
                        <Input
                            id="item_name"
                            value={form.data.item_name}
                            onChange={(e) =>
                                form.setData('item_name', e.target.value)
                            }
                            placeholder="Enter item name"
                            required
                        />
                    </FormField>
                    <FormField
                        label="Property number"
                        htmlFor="property_number"
                        error={form.errors.property_number}
                        required
                    >
                        <Input
                            id="property_number"
                            value={form.data.property_number}
                            onChange={(e) =>
                                form.setData('property_number', e.target.value)
                            }
                            placeholder="Enter property number"
                            required
                        />
                    </FormField>
                    <FormField
                        label="Serial no."
                        htmlFor="serial_no"
                        error={form.errors.serial_no}
                    >
                        <Input
                            id="serial_no"
                            value={form.data.serial_no}
                            onChange={(e) =>
                                form.setData('serial_no', e.target.value)
                            }
                            placeholder="Enter serial number"
                        />
                    </FormField>
                    <FormField
                        label="Model no."
                        htmlFor="model_no"
                        error={form.errors.model_no}
                    >
                        <Input
                            id="model_no"
                            value={form.data.model_no}
                            onChange={(e) =>
                                form.setData('model_no', e.target.value)
                            }
                            placeholder="Enter model number"
                        />
                    </FormField>
                    <FormField
                        label="Acquisition date"
                        htmlFor="acquisition_date"
                        error={form.errors.acquisition_date}
                    >
                        <Input
                            id="acquisition_date"
                            type="date"
                            value={form.data.acquisition_date}
                            onChange={(e) =>
                                form.setData('acquisition_date', e.target.value)
                            }
                        />
                    </FormField>
                    <FormField
                        label="Acquisition cost"
                        htmlFor="acquisition_cost"
                        error={form.errors.acquisition_cost}
                    >
                        <Input
                            id="acquisition_cost"
                            inputMode="decimal"
                            value={form.data.acquisition_cost}
                            onChange={(e) =>
                                form.setData(
                                    'acquisition_cost',
                                    e.target.value.replace(/[^\d.,]/g, ''),
                                )
                            }
                            onBlur={() =>
                                form.setData(
                                    'acquisition_cost',
                                    formatCost(form.data.acquisition_cost),
                                )
                            }
                            placeholder="0.00"
                        />
                    </FormField>
                    <FormField
                        label="Unit of measure"
                        htmlFor="unit_of_measure"
                        error={form.errors.unit_of_measure}
                    >
                        <Input
                            id="unit_of_measure"
                            value={form.data.unit_of_measure}
                            onChange={(e) =>
                                form.setData('unit_of_measure', e.target.value)
                            }
                            placeholder="e.g. piece or box"
                            maxLength={50}
                        />
                    </FormField>
                    <FormField
                        label="Quantity (physical count)"
                        htmlFor="quantity_per_physical_count"
                        error={form.errors.quantity_per_physical_count}
                        required
                    >
                        <Input
                            id="quantity_per_physical_count"
                            type="number"
                            min={1}
                            value={form.data.quantity_per_physical_count}
                            onChange={(e) =>
                                form.setData(
                                    'quantity_per_physical_count',
                                    e.target.value,
                                )
                            }
                            required
                        />
                    </FormField>
                    <FormField
                        label="Fund"
                        htmlFor="fund"
                        error={form.errors.fund}
                    >
                        <NativeSelect
                            id="fund"
                            value={form.data.fund}
                            onChange={(e) =>
                                form.setData('fund', e.target.value)
                            }
                        >
                            <option value="">Select fund</option>
                            {fundOptions.map((fund) => (
                                <option key={fund} value={fund}>
                                    {fund}
                                </option>
                            ))}
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="Condition"
                        htmlFor="condition"
                        error={form.errors.condition}
                        required
                    >
                        <NativeSelect
                            id="condition"
                            value={form.data.condition}
                            onChange={(e) =>
                                form.setData('condition', e.target.value)
                            }
                            required
                        >
                            <option value="" disabled>
                                Select condition
                            </option>
                            {conditionOptions.map((condition) => (
                                <option key={condition} value={condition}>
                                    {condition}
                                </option>
                            ))}
                        </NativeSelect>
                    </FormField>
                    <FormField
                        label="Location / whereabouts"
                        htmlFor="location_id"
                        error={form.errors.location_id}
                        required
                    >
                        <SearchableSelect
                            id="location_id"
                            options={locationOptions}
                            value={form.data.location_id}
                            onChange={(value) =>
                                form.setData('location_id', value)
                            }
                            placeholder="Select location"
                            searchPlaceholder="Search locations..."
                            emptyText="No locations found."
                            invalid={Boolean(form.errors.location_id)}
                        />
                    </FormField>
                    <FormField
                        label="Assigned to (MR)"
                        htmlFor="user_id"
                        error={form.errors.user_id}
                        required
                    >
                        <SearchableSelect
                            id="user_id"
                            options={userOptions}
                            value={form.data.user_id}
                            onChange={(value) => form.setData('user_id', value)}
                            placeholder="Select user"
                            searchPlaceholder="Search users..."
                            emptyText="No users found."
                            invalid={Boolean(form.errors.user_id)}
                        />
                    </FormField>
                    <FormField
                        label="Description"
                        htmlFor="item_description"
                        error={form.errors.item_description}
                        className="sm:col-span-2"
                    >
                        <Textarea
                            id="item_description"
                            rows={3}
                            value={form.data.item_description}
                            onChange={(e) =>
                                form.setData('item_description', e.target.value)
                            }
                            placeholder="Short description of the item"
                        />
                    </FormField>
                    <FormField
                        label="Remarks"
                        htmlFor="remarks"
                        error={form.errors.remarks}
                        className="sm:col-span-2"
                    >
                        <Textarea
                            id="remarks"
                            rows={3}
                            value={form.data.remarks}
                            onChange={(e) =>
                                form.setData('remarks', e.target.value)
                            }
                            placeholder="Any additional notes"
                        />
                    </FormField>
                    <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                        <Button asChild variant="outline">
                            <Link href={propertiesIndex()}>Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            {editing ? 'Save changes' : 'Add property'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
