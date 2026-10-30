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

type WallClock = {
    year: number;
    /** 0 = January */
    month: number;
    day: number;
    hours: number;
    minutes: number;
};

const manilaClock = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
});

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * The date and time to show for a value, the same on the server (SSR) and
 * in any browser: timestamps with a zone ("…Z") in Philippine time, values
 * without one ("2025-03-14", "2025-03-14 16:00:00") exactly as written.
 */
function wallClock(value: string | null | undefined): WallClock | null {
    if (!value) {
        return null;
    }

    const plain =
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/.exec(
            value,
        );

    if (plain) {
        return {
            year: Number(plain[1]),
            month: Number(plain[2]) - 1,
            day: Number(plain[3]),
            hours: Number(plain[4] ?? 0),
            minutes: Number(plain[5] ?? 0),
        };
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const parts = Object.fromEntries(
        manilaClock.formatToParts(date).map((part) => [part.type, part.value]),
    );

    return {
        year: Number(parts.year),
        month: Number(parts.month) - 1,
        day: Number(parts.day),
        hours: Number(parts.hour) % 24,
        minutes: Number(parts.minute),
    };
}

/** "Mar 14, 2025" (Carbon M d, Y) */
export function formatDate(
    value: string | null | undefined,
    fallback = '—',
): string {
    const clock = wallClock(value);

    return clock
        ? `${MONTHS_SHORT[clock.month]} ${pad2(clock.day)}, ${clock.year}`
        : fallback;
}

/** "March 14, 2025" (Carbon F d, Y) */
export function formatLongDate(
    value: string | null | undefined,
    fallback = '—',
): string {
    const clock = wallClock(value);

    return clock
        ? `${MONTHS_LONG[clock.month]} ${pad2(clock.day)}, ${clock.year}`
        : fallback;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * "just now", "5 min ago", "3 hr ago", "yesterday", then "Oct 22" (and the
 * year when it isn't this year), for notifications.
 */
export function formatRelative(
    value: string | null | undefined,
    now: Date = new Date(),
): string {
    const date = parseDate(value);

    if (!date) {
        return '';
    }

    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

    if (seconds < 45) {
        return 'just now';
    }

    if (seconds < 3600) {
        return `${Math.round(seconds / 60)} min ago`;
    }

    if (seconds < 86_400) {
        return `${Math.round(seconds / 3600)} hr ago`;
    }

    if (seconds < 2 * 86_400) {
        return relative.format(-1, 'day');
    }

    const clock = wallClock(value);
    const thisYear = wallClock(now.toISOString())?.year;

    if (!clock) {
        return '';
    }

    const day = `${MONTHS_SHORT[clock.month]} ${clock.day}`;

    return clock.year === thisYear ? day : `${day}, ${clock.year}`;
}

/** "02:30 PM" (Carbon h:i A) */
export function formatTime(
    value: string | null | undefined,
    fallback = '',
): string {
    const clock = wallClock(value);

    if (!clock) {
        return fallback;
    }

    const h12 = clock.hours % 12 === 0 ? 12 : clock.hours % 12;

    return `${pad2(h12)}:${pad2(clock.minutes)} ${clock.hours >= 12 ? 'PM' : 'AM'}`;
}

/** "Mar 14, 2025 02:30 PM" */
export function formatDateTime(
    value: string | null | undefined,
    fallback = '—',
): string {
    return wallClock(value)
        ? `${formatDate(value)} ${formatTime(value)}`
        : fallback;
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
