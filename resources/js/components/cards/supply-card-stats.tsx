import type { ReactNode } from 'react';
import { toNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export type StatTone = 'neutral' | 'green' | 'amber' | 'red';

const dotTones: Record<Exclude<StatTone, 'neutral'>, string> = {
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
};

export type StatTile = {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    /** Adds a status dot before the hint (used for the stock level). */
    tone?: StatTone;
};

/**
 * Figures under the Stock Card / Supply Ledger Card banner: one hairline
 * panel split into cells, label above a large figure, no icons.
 */
export function SupplyCardStats({ tiles }: { tiles: StatTile[] }) {
    return (
        <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-5">
            {tiles.map(({ label, value, hint, tone = 'neutral' }) => (
                <div
                    key={label}
                    className="min-w-0 bg-card px-5 py-4 sm:last:col-span-2 lg:last:col-span-1"
                >
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1.5 truncate text-xl font-semibold tracking-tight tabular-nums">
                        {value}
                    </dd>
                    {hint && (
                        <dd className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {tone !== 'neutral' && (
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-1.5 shrink-0 rounded-full',
                                        dotTones[tone],
                                    )}
                                />
                            )}
                            {hint}
                        </dd>
                    )}
                </div>
            ))}
        </dl>
    );
}

/** Stock level of the current balance against the supply's reorder point. */
export function balanceStatus(
    balance: number | string,
    reorderPoint: number | string | null | undefined,
): { tone: StatTone; label: string } {
    const quantity = toNumber(balance);

    if (quantity <= 0) {
        return { tone: 'red', label: 'Out of stock' };
    }

    if (quantity <= toNumber(reorderPoint ?? 0)) {
        return { tone: 'amber', label: 'Low stock, reorder' };
    }

    return { tone: 'green', label: 'In stock' };
}
