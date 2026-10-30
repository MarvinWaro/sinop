import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';

/** A line item plus a client-only key for React; never sent to the server. */
export type Keyed<T> = T & { row_key: string };

let lastRowKey = 0;

export function withRowKey<T extends object>(item: T): Keyed<T> {
    lastRowKey += 1;

    return { ...item, row_key: `row-${lastRowKey}` };
}

/** The items as the server expects them (without `row_key`). */
export function stripRowKeys<T extends object>(items: Keyed<T>[]): T[] {
    return items.map((keyed) => {
        const item: Partial<Keyed<T>> = { ...keyed };
        delete item.row_key;

        return item as T;
    });
}

/**
 * Add / update / remove for a form's `items` list (IAR, manual RIS).
 *
 * Items stay in the order they were entered (that is the order saved and
 * printed, and the order of `items.N` validation errors); pages may show
 * them newest first. Updates go through Inertia's functional `setData`, so
 * the callbacks are stable and memoized rows only re-render when their own
 * item changes. `newestKey` is the row added last, to scroll to and open.
 */
export function useLineItems<T extends object, F extends { items: Keyed<T>[] }>(
    setData: (update: (data: F) => F) => void,
    create: () => T,
) {
    const [newestKey, setNewestKey] = useState<string | null>(null);

    const setItems = useCallback(
        (update: (items: Keyed<T>[]) => Keyed<T>[]) =>
            setData((data) => ({ ...data, items: update(data.items) })),
        [setData],
    );

    const add = useCallback(() => {
        const item = withRowKey(create());

        setItems((items) => [...items, item]);
        setNewestKey(item.row_key);
    }, [setItems, create]);

    const update = useCallback(
        (index: number, patch: Partial<T>) =>
            setItems((items) =>
                items.map((item, i) =>
                    i === index ? { ...item, ...patch } : item,
                ),
            ),
        [setItems],
    );

    const remove = useCallback(
        (index: number) =>
            setItems((items) => items.filter((_, i) => i !== index)),
        [setItems],
    );

    return { add, update, remove, newestKey };
}

/**
 * Row key handler: Enter in a text/number field adds the next item instead
 * of submitting the whole form. Keys already handled (e.g. Enter picking a
 * supply in a searchable list) are left alone.
 */
export function addItemOnEnter(add: () => void) {
    return (event: KeyboardEvent<HTMLElement>) => {
        if (
            event.key !== 'Enter' ||
            event.defaultPrevented ||
            !(event.target instanceof HTMLInputElement)
        ) {
            return;
        }

        event.preventDefault();
        add();
    };
}
