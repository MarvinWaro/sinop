import { router } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type QueryValue = string | number | null | undefined;

type Props = {
    /** URL to submit to (usually the current index route). */
    url: string;
    defaultValue?: string | null;
    placeholder?: string;
    /** Other query params to keep (filters, status, ...). */
    params?: Record<string, QueryValue>;
    /** Query parameter name, defaults to "search". */
    name?: string;
    className?: string;
};

function cleanParams(
    params: Record<string, QueryValue>,
): Record<string, string | number> {
    return Object.fromEntries(
        Object.entries(params).filter(
            ([, value]) =>
                value !== null && value !== undefined && value !== '',
        ),
    ) as Record<string, string | number>;
}

export function SearchForm({
    url,
    defaultValue,
    placeholder = 'Search...',
    params = {},
    name = 'search',
    className,
}: Props) {
    const [value, setValue] = useState(defaultValue ?? '');

    const visit = (search: string) => {
        router.get(url, cleanParams({ ...params, [name]: search }), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit(value.trim());
    };

    return (
        <form
            onSubmit={submit}
            className={cn('flex w-full gap-2 sm:w-auto', className)}
        >
            <div className="relative flex-1 sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    placeholder={placeholder}
                    className="pr-8 pl-8"
                    aria-label={placeholder}
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => {
                            setValue('');
                            visit('');
                        }}
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                        aria-label="Clear search"
                    >
                        <X className="size-4" />
                    </button>
                )}
            </div>
            <Button type="submit" variant="secondary">
                Search
            </Button>
        </form>
    );
}

/** Navigate to `url` with the given query (empty values removed). */
export function visitWithQuery(
    url: string,
    params: Record<string, QueryValue>,
) {
    router.get(url, cleanParams(params), {
        preserveState: true,
        preserveScroll: true,
        replace: true,
    });
}
