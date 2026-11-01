import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type SearchableOption = {
    value: string;
    label: string;
    /** A short code shown right after the label (e.g. a stock no.), in italic blue. */
    code?: string | null;
    description?: string | null;
    meta?: string | null;
    group?: string | null;
    disabled?: boolean;
};

type Props = {
    options: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    id?: string;
    invalid?: boolean;
    disabled?: boolean;
    className?: string;
    /** Open the list on mount (e.g. a row that was just added). */
    defaultOpen?: boolean;
    /**
     * Lets the person add what they typed when nothing matches it exactly:
     * the last row reads "Add “…”".
     */
    onCreate?: (text: string) => void;
    createLabel?: (text: string) => string;
};

function OptionCode({ code }: { code?: string | null }) {
    return code ? (
        <span className="ml-1.5 text-primary italic">{code}</span>
    ) : null;
}

/**
 * Searchable select for long lists (supplies, users). The list floats above
 * the form in a popover, so opening it never stretches a table row or pushes
 * the rest of a dialog down; it flips upward when there's no room below and
 * scrolls on its own inside dialogs (modal popover).
 */
export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    emptyText = 'No results found.',
    id,
    invalid,
    disabled,
    className,
    defaultOpen = false,
    onCreate,
    createLabel = (text) => `Add “${text}”`,
}: Props) {
    const [open, setOpen] = useState(defaultOpen);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const searchInput = useRef<HTMLInputElement>(null);

    const selected = options.find((option) => option.value === value);
    const term = query.trim().toLowerCase();
    const filtered = term
        ? options.filter((option) =>
              `${option.label} ${option.code ?? ''} ${option.description ?? ''} ${option.meta ?? ''} ${option.group ?? ''}`
                  .toLowerCase()
                  .includes(term),
          )
        : options;
    // What can be added: the typed text, unless an option already has it.
    const createText =
        onCreate &&
        term &&
        !options.some((option) => option.label.trim().toLowerCase() === term)
            ? query.trim().replace(/\s+/g, ' ')
            : null;
    const lastIndex = filtered.length - (createText ? 0 : 1);

    const create = () => {
        if (createText && onCreate) {
            onCreate(createText);
            setOpen(false);
            setQuery('');
        }
    };

    const choose = (option: SearchableOption | undefined) => {
        if (!option || option.disabled) {
            return;
        }

        onChange(option.value);
        setOpen(false);
        setQuery('');
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((index) => Math.min(index + 1, lastIndex));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();

            if (createText && highlight === filtered.length) {
                create();
            } else {
                choose(filtered[highlight]);
            }
        }
        // Escape is handled by the popover: it closes the list only, not the dialog.
    };

    return (
        <Popover
            modal
            open={open}
            onOpenChange={(next: boolean) => {
                setOpen(next);

                if (next) {
                    setHighlight(0);
                }
            }}
        >
            <PopoverTrigger asChild>
                <button
                    id={id}
                    type="button"
                    disabled={disabled}
                    aria-invalid={invalid || undefined}
                    className={cn(
                        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-xs outline-none dark:bg-input/30',
                        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        className,
                    )}
                >
                    <span
                        className={cn(
                            'truncate',
                            !selected && 'text-muted-foreground',
                        )}
                    >
                        {selected ? (
                            <>
                                {selected.label}
                                <OptionCode code={selected.code} />
                            </>
                        ) : (
                            placeholder
                        )}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                collisionPadding={8}
                className="w-(--radix-popover-trigger-width) min-w-64 overflow-hidden p-0"
                onOpenAutoFocus={(event: Event) => {
                    event.preventDefault();
                    searchInput.current?.focus();
                }}
            >
                <div className="flex items-center gap-2 border-b px-3">
                    <Search className="size-4 shrink-0 opacity-50" />
                    <input
                        ref={searchInput}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setHighlight(0);
                        }}
                        onKeyDown={onKeyDown}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
                <div
                    className="max-h-[min(16rem,calc(var(--radix-popover-content-available-height)-2.5rem))] overflow-y-auto p-1"
                    role="listbox"
                >
                    {filtered.length === 0 && !createText ? (
                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                            {emptyText}
                        </p>
                    ) : (
                        filtered.map((option, index) => {
                            const showGroup =
                                Boolean(option.group) &&
                                option.group !== filtered[index - 1]?.group;

                            return (
                                <div key={option.value}>
                                    {showGroup && (
                                        <p className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                                            {option.group}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={option.value === value}
                                        disabled={option.disabled}
                                        onMouseEnter={() => setHighlight(index)}
                                        onClick={() => choose(option)}
                                        className={cn(
                                            'flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                                            index === highlight &&
                                                'bg-accent text-accent-foreground',
                                            option.disabled &&
                                                'cursor-not-allowed opacity-50',
                                        )}
                                    >
                                        <Check
                                            className={cn(
                                                'mt-0.5 size-4 shrink-0',
                                                option.value === value
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                            )}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">
                                                {option.label}
                                                <OptionCode
                                                    code={option.code}
                                                />
                                            </span>
                                            {option.description && (
                                                <span className="block truncate text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                        {option.meta && (
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                {option.meta}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                    {createText && (
                        <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onMouseEnter={() => setHighlight(filtered.length)}
                            onClick={create}
                            className={cn(
                                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                                filtered.length > 0 && 'mt-1 border-t pt-2',
                                highlight === filtered.length &&
                                    'bg-accent text-accent-foreground',
                            )}
                        >
                            <Plus className="size-4 shrink-0" />
                            <span className="truncate">
                                {createLabel(createText)}
                            </span>
                        </button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
