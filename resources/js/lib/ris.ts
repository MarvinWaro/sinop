import type { RisSlip } from '@/types';

export type RisDisplayStatus =
    | 'draft'
    | 'approved'
    | 'pending-receipt'
    | 'completed'
    | 'declined';

/** Same buckets the Blade views used for badges and filters. */
export function risDisplayStatus(
    slip: Pick<RisSlip, 'status' | 'received_at'>,
): RisDisplayStatus {
    if (slip.status === 'posted') {
        return slip.received_at ? 'completed' : 'pending-receipt';
    }

    return slip.status;
}

export const risStatusLabels: Record<RisDisplayStatus, string> = {
    draft: 'Pending',
    approved: 'Approved',
    'pending-receipt': 'Issued - Pending Receipt',
    completed: 'Completed',
    declined: 'Declined',
};

export const risStatusClasses: Record<RisDisplayStatus, string> = {
    draft: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    approved:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300',
    'pending-receipt':
        'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300',
    completed:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    declined:
        'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
};

/**
 * RIS URLs use an obfuscated key (RisSlip::getRouteKey), not the numeric id.
 * Wayfinder types the parameter as the model's key column (a number), so the
 * encoded key is passed through this helper.
 */
export function risKey(slip: Pick<RisSlip, 'route_key'>): number {
    return slip.route_key as unknown as number;
}

/** "Item name, description" as shown on the RIS form. */
export function supplyLabel(
    supply:
        | { item_name: string; description: string | null }
        | null
        | undefined,
): string {
    if (!supply) {
        return 'N/A';
    }

    return [supply.item_name, supply.description].filter(Boolean).join(', ');
}
