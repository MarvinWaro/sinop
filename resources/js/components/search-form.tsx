import { router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { SearchInput } from '@/components/search-input';
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

/** How long typing has to pause before the list reloads. */
const TYPING_PAUSE_MS = 350;

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

/**
 * Runs the latest scheduled callback once calls stop for `delay` ms (a pause
 * in typing). `cancel` drops a pending run, e.g. when applying right away.
 */
export function useTypingPause(delay = TYPING_PAUSE_MS) {
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    return useMemo(
        () => ({
            schedule: (run: () => void) => {
                window.clearTimeout(timer.current);
                timer.current = window.setTimeout(run, delay);
            },
            cancel: () => window.clearTimeout(timer.current),
        }),
        [delay],
    );
}

/**
 * Server-side search box that searches as you type: the list reloads once
 * typing pauses, and right away on Enter or when cleared.
 */
export function SearchForm({
    url,
    defaultValue,
    placeholder = 'Search...',
    params = {},
    name = 'search',
    className,
}: Props) {
    const [value, setValue] = useState(defaultValue ?? '');
    const pause = useTypingPause();
    // The search the list is showing, so a pause or Enter doesn't reload it.
    const applied = useRef((defaultValue ?? '').trim());
    // A run scheduled before another filter changed uses the new filters.
    const latestParams = useRef(params);

    useEffect(() => {
        latestParams.current = params;
    });

    const visit = (search: string) => {
        pause.cancel();

        if (search === applied.current) {
            return;
        }

        applied.current = search;
        router.get(
            url,
            cleanParams({ ...latestParams.current, [name]: search }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const change = (next: string) => {
        setValue(next);
        pause.schedule(() => visit(next.trim()));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit(value.trim());
    };

    return (
        <form
            onSubmit={submit}
            role="search"
            className={cn('flex w-full gap-2 sm:w-auto', className)}
        >
            <SearchInput
                value={value}
                onValueChange={change}
                onClear={() => {
                    setValue('');
                    visit('');
                }}
                placeholder={placeholder}
                aria-label={placeholder}
                className="flex-1 sm:w-72"
            />
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
