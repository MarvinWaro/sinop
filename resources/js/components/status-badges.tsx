import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { risDisplayStatus, risStatusClasses, risStatusLabels } from '@/lib/ris';
import type { RisSlip, SupplyStock, TransactionType } from '@/types';

const tone = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    red: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
    gray: 'border-border bg-muted text-muted-foreground',
};

export function RisStatusBadge({
    slip,
    className,
}: {
    slip: Pick<RisSlip, 'status' | 'received_at'>;
    className?: string;
}) {
    const status = risDisplayStatus(slip);

    return (
        <Badge
            variant="outline"
            className={cn(risStatusClasses[status], className)}
        >
            {risStatusLabels[status]}
        </Badge>
    );
}

export function TransactionTypeBadge({ type }: { type: TransactionType }) {
    const map: Record<TransactionType, [string, string]> = {
        receipt: ['Receipt', tone.green],
        issue: ['Issue', tone.red],
        adjustment: ['Adjustment', tone.amber],
    };
    const [label, classes] = map[type] ?? [type, tone.gray];

    return (
        <Badge variant="outline" className={classes}>
            {label}
        </Badge>
    );
}

export function StockStatusBadge({
    stock,
}: {
    stock: Pick<SupplyStock, 'dynamic_status' | 'status_display' | 'status'>;
}) {
    const status = stock.dynamic_status ?? stock.status;
    const classes =
        status === 'depleted' || status === 'expired'
            ? tone.red
            : status === 'low_stock'
              ? tone.amber
              : status === 'reserved'
                ? tone.blue
                : tone.green;

    return (
        <Badge variant="outline" className={classes}>
            {stock.status_display ?? status}
        </Badge>
    );
}

export function ActiveBadge({
    active,
    activeLabel = 'Active',
    inactiveLabel = 'Inactive',
}: {
    active: boolean;
    activeLabel?: string;
    inactiveLabel?: string;
}) {
    return (
        <Badge variant="outline" className={active ? tone.green : tone.red}>
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    active ? 'bg-emerald-500' : 'bg-red-500',
                )}
            />
            {active ? activeLabel : inactiveLabel}
        </Badge>
    );
}

export function RoleBadge({ role }: { role: string }) {
    const label = role === 'admin' ? 'Admin' : role === 'cao' ? 'CAO' : 'Staff';
    const classes =
        role === 'admin' ? tone.red : role === 'cao' ? tone.blue : tone.gray;

    return (
        <Badge variant="outline" className={classes}>
            {label}
        </Badge>
    );
}

/** A user's roles as badges: Administrator red, CAO blue, the rest grey. */
export function RoleBadges({
    roles,
}: {
    roles: { id: number; name: string; slug: string }[] | undefined;
}) {
    if (!roles || roles.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span className="flex flex-wrap gap-1">
            {roles.map((role) => (
                <Badge
                    key={role.id}
                    variant="outline"
                    className={
                        role.slug === 'admin'
                            ? tone.red
                            : role.slug === 'cao'
                              ? tone.blue
                              : tone.gray
                    }
                >
                    {role.name}
                </Badge>
            ))}
        </span>
    );
}

/** Property condition (Serviceable / Unserviceable / legacy values). */
export function ConditionBadge({
    condition,
}: {
    condition: string | null | undefined;
}) {
    const value = (condition ?? '').toLowerCase();
    const classes =
        value === 'serviceable'
            ? tone.green
            : value === 'unserviceable'
              ? tone.red
              : tone.gray;

    return (
        <Badge variant="outline" className={classes}>
            {condition || 'TBD/NA'}
        </Badge>
    );
}

export const badgeTone = tone;
