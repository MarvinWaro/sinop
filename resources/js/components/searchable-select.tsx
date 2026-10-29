import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

export type SearchableOption = {
    value: string;
    label: string;
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
};

/**
 * Searchable select for long lists (supplies, users). The list opens inline
 * below the trigger so it is never clipped inside scrolling dialogs.
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
}: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(0);
    const container = useRef<HTMLDivElement>(null);
    const searchInput = useRef<HTMLInputElement>(null);

    const selected = options.find((option) => option.value === value);
    const term = query.trim().toLowerCase();
    const filtered = term
        ? options.filter((option) =>
              `${option.label} ${option.description ?? ''} ${option.meta ?? ''} ${option.group ?? ''}`
                  .toLowerCase()
                  .includes(term),
          )
        : options;

    useEffect(() => {
        if (!open) {
            return;
        }

        searchInput.current?.focus();

        const onPointerDown = (event: PointerEvent) => {
            if (
                container.current &&
                !container.current.contains(event.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('pointerdown', onPointerDown);

        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [open]);

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
            setHighlight((index) => Math.min(index + 1, filtered.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(filtered[highlight]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        }
    };

    return (
        <div ref={container} className={cn('relative w-full', className)}>
            <button
                id={id}
                type="button"
                disabled={disabled}
                aria-invalid={invalid || undefined}
                aria-expanded={open}
                onClick={() => {
                    setOpen((current) => !current);
                    setHighlight(0);
                }}
                className={cn(
                    'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-xs outline-none dark:bg-input/30',
                    'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                )}
            >
                <span
                    className={cn(
                        'truncate',
                        !selected && 'text-muted-foreground',
                    )}
                >
                    {selected ? selected.label : placeholder}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
            </button>

            {open && (
                <div className="mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
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
                            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    <div
                        className="max-h-64 overflow-y-auto p-1"
                        role="listbox"
                    >
                        {filtered.length === 0 ? (
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
                                            aria-selected={
                                                option.value === value
                                            }
                                            disabled={option.disabled}
                                            onMouseEnter={() =>
                                                setHighlight(index)
                                            }
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
                    </div>
                </div>
            )}
        </div>
    );
}
