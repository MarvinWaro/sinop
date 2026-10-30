import { Search, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = Omit<
    ComponentProps<typeof Input>,
    'type' | 'value' | 'onChange' | 'className'
> & {
    value: string;
    onValueChange: (value: string) => void;
    /** What the clear button does; defaults to emptying the box. */
    onClear?: () => void;
    /** Classes for the wrapper (width, flex). */
    className?: string;
};

/**
 * Search box with a search icon and a single clear button. The browser's
 * own clear "×" is hidden in app.css, so only this one shows.
 */
export function SearchInput({
    value,
    onValueChange,
    onClear,
    className,
    ...props
}: Props) {
    return (
        <div className={cn('relative', className)}>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="search"
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                className="pr-8 pl-8"
                {...props}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => (onClear ? onClear() : onValueChange(''))}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}
