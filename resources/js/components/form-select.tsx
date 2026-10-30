import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type FormSelectOption = {
    value: string | number;
    label: string;
    disabled?: boolean;
};

export type FormSelectGroup = {
    label: string;
    options: FormSelectOption[];
};

type Props = {
    value?: string | number | null;
    /** For uncontrolled selects inside a `<form>` (submitted through `name`). */
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    options?: FormSelectOption[];
    /** Labelled sections, like a native `<optgroup>`. */
    groups?: FormSelectGroup[];
    /** Shown while nothing is chosen (value `''`). */
    placeholder?: string;
    id?: string;
    name?: string;
    required?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    tabIndex?: number;
    className?: string;
    contentClassName?: string;
    'aria-label'?: string;
};

// Radix Select items can't use '' as a value, so "All …" / "None" options
// travel under this key and come back to the caller as ''.
const EMPTY_VALUE = '__form_select_empty__';

/**
 * shadcn Select driven by an options list, a drop-in for the old native
 * selects: values are strings in and out (numbers are converted), an option
 * with value '' is allowed, and without one '' shows the placeholder.
 * `required` + `name` keep working in forms (Radix renders a hidden select).
 */
export function FormSelect({
    value,
    defaultValue,
    onValueChange,
    options = [],
    groups = [],
    placeholder,
    id,
    name,
    required,
    disabled,
    invalid,
    tabIndex,
    className,
    contentClassName,
    'aria-label': ariaLabel,
}: Props) {
    const hasEmptyOption = [
        ...options,
        ...groups.flatMap((group) => group.options),
    ].some((option) => String(option.value) === '');

    const toSelectValue = (raw: string | number | null | undefined) => {
        const text = raw === null || raw === undefined ? '' : String(raw);

        return text === '' && hasEmptyOption ? EMPTY_VALUE : text;
    };

    const renderOption = (option: FormSelectOption) => (
        <SelectItem
            key={String(option.value)}
            value={toSelectValue(option.value)}
            disabled={option.disabled}
        >
            {option.label}
        </SelectItem>
    );

    return (
        <Select
            value={value === undefined ? undefined : toSelectValue(value)}
            defaultValue={
                defaultValue === undefined
                    ? undefined
                    : toSelectValue(defaultValue)
            }
            onValueChange={(next) =>
                onValueChange?.(next === EMPTY_VALUE ? '' : next)
            }
            name={name}
            required={required}
            disabled={disabled}
        >
            <SelectTrigger
                id={id}
                tabIndex={tabIndex}
                aria-label={ariaLabel}
                aria-invalid={invalid || undefined}
                className={cn('w-full min-w-0', className)}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent
                avoidCollisions
                collisionPadding={8}
                className={cn(
                    'max-h-[min(20rem,var(--radix-select-content-available-height))]',
                    contentClassName,
                )}
            >
                {options.map(renderOption)}
                {groups.map((group) => (
                    <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.options.map(renderOption)}
                    </SelectGroup>
                ))}
            </SelectContent>
        </Select>
    );
}
