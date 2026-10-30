import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { SearchInput } from '@/components/search-input';
import { Button } from '@/components/ui/button';
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
            <SearchInput
                value={value}
                onValueChange={setValue}
                onClear={() => {
                    setValue('');
                    visit('');
                }}
                placeholder={placeholder}
                aria-label={placeholder}
                className="flex-1 sm:w-72"
            />
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
