import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Faint cell grid: a hairline between every row and column, at 60% of the border colour. */
const gridLines =
    '[&_td:not(:last-child)]:border-r [&_th:not(:last-child)]:border-r [&_td]:border-border/60 [&_th]:border-border/60 [&_tr]:border-border/60';

/**
 * The one bordered box around a data table. Toolbars (search, filters) sit
 * on the page above it rather than inside another card, so a list never
 * shows a box inside a box.
 *
 * `flush` is for a table that lives inside a titled card: no border of its
 * own, just a divider under the card title, running edge to edge.
 * `lines` draws the faint row/column grid (on by default).
 */
export function TablePanel({
    children,
    flush = false,
    lines = true,
    className,
}: {
    children: ReactNode;
    flush?: boolean;
    lines?: boolean;
    className?: string;
}) {
    return (
        <div
            className={cn(
                '[&_thead]:bg-muted/50',
                lines && gridLines,
                flush
                    ? '-mx-6 border-t [&_td:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:first-child]:pl-6 [&_th:last-child]:pr-6'
                    : 'overflow-hidden rounded-xl border bg-card [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4',
                className,
            )}
        >
            {children}
        </div>
    );
}
