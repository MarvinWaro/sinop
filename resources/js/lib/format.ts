/**
 * Formatting helpers shared by the pages (mirrors the number_format / Carbon
 * formats the Blade views used).
 */

const MONTHS_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

const MONTHS_LONG = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

export const monthNames = MONTHS_LONG;
export const shortMonthNames = MONTHS_SHORT;

export function toNumber(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
        const parsed = parseFloat(value.replace(/,/g, ''));

        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
}

/** 1234.5 -> "1,234.50" (number_format($value, 2)) */
export function formatMoney(value: unknown, decimals = 2): string {
    return toNumber(value).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/** 1234.5 -> "₱1,234.50" */
export function formatPeso(value: unknown, decimals = 2): string {
    return `₱${formatMoney(value, decimals)}`;
}

/** Axis-friendly peso amounts: 1234 -> "₱1.2k", 2500000 -> "₱2.5M". */
export function formatCompactPeso(value: unknown): string {
    const n = toNumber(value);
    const abs = Math.abs(n);

    if (abs >= 1_000_000) {
        return `₱${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }

    if (abs >= 1_000) {
        return `₱${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
    }

    return `₱${Math.round(n).toLocaleString('en-US')}`;
}

/** 1234 -> "1,234" (number_format($value)) */
export function formatNumber(value: unknown): string {
    return Math.round(toNumber(value)).toLocaleString('en-US');
}

/**
 * Parse "2025-03-14", "2025-03-14 16:00:00" or an ISO string. Date-only values
 * are treated as local dates so they don't shift across timezones.
 */
export function parseDate(value: string | null | undefined): Date | null {
    if (!value) {
        return null;
    }

    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (dateOnly) {
        return new Date(
            Number(dateOnly[1]),
            Number(dateOnly[2]) - 1,
            Number(dateOnly[3]),
        );
    }

    const date = new Date(
        value.includes('T') ? value : value.replace(' ', 'T'),
    );

    return Number.isNaN(date.getTime()) ? null : date;
}

/** "Mar 14, 2025" (Carbon M d, Y) */
export function formatDate(
    value: string | null | undefined,
    fallback = '—',
): string {
    const date = parseDate(value);

    if (!date) {
        return fallback;
    }

    return `${MONTHS_SHORT[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
}

/** "March 14, 2025" (Carbon F d, Y) */
export function formatLongDate(
    value: string | null | undefined,
    fallback = '—',
): string {
    const date = parseDate(value);

    if (!date) {
        return fallback;
    }

    return `${MONTHS_LONG[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
}

/** "02:30 PM" (Carbon h:i A) */
export function formatTime(
    value: string | null | undefined,
    fallback = '',
): string {
    const date = parseDate(value);

    if (!date) {
        return fallback;
    }

    const hours = date.getHours();
    const h12 = hours % 12 === 0 ? 12 : hours % 12;

    return `${String(h12).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

/** "Mar 14, 2025 02:30 PM" */
export function formatDateTime(
    value: string | null | undefined,
    fallback = '—',
): string {
    const date = parseDate(value);

    if (!date) {
        return fallback;
    }

    return `${formatDate(value)} ${formatTime(value)}`;
}

/** "2025-03" -> "March 2025" */
export function formatMonthKey(value: string | null | undefined): string {
    if (!value) {
        return '';
    }

    const [year, month] = value.split('-');
    const index = Number(month) - 1;

    return index >= 0 && index < 12 ? `${MONTHS_LONG[index]} ${year}` : value;
}

/** Today as "YYYY-MM-DD" in the browser's local time. */
export function todayIso(): string {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function initialsOf(name: string | null | undefined): string {
    if (!name) {
        return '?';
    }

    const parts = name.trim().split(/\s+/);

    return (
        (parts[0]?.[0] ?? '') +
        (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
    ).toUpperCase();
}

export function truncate(
    value: string | null | undefined,
    length: number,
): string {
    if (!value) {
        return '';
    }

    return value.length > length ? `${value.slice(0, length)}...` : value;
}

/** "101" -> "Fund cluster 101", empty -> "All fund clusters". */
export function fundClusterLabel(cluster: string | null | undefined): string {
    return cluster ? `Fund cluster ${cluster}` : 'All fund clusters';
}
