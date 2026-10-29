import { Head, router } from '@inertiajs/react';
import { Building2, Clock, Globe, History, Monitor } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { DataPagination } from '@/components/data-pagination';
import { EmptyState } from '@/components/empty-state';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { formatNumber, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index as activityLogsIndex } from '@/routes/activity-logs';
import type { Paginated } from '@/types';
import type {
    ActivityEntry,
    ActivityFilters,
    ActivityOption,
    ActivityTone,
} from '@/types/activity';

type Props = {
    logs: Paginated<ActivityEntry>;
    filters: ActivityFilters;
    modules: ActivityOption[];
    actions: ActivityOption[];
    users: { id: number; name: string }[];
};

const emptyFilters: ActivityFilters = {
    search: '',
    module: '',
    action: '',
    user: '',
    from: '',
    to: '',
};

const badgeTones: Record<ActivityTone, string> = {
    positive:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    change: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
    negative: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
    output: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    account:
        'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
    neutral: 'bg-muted text-muted-foreground',
};

const accentTones: Record<ActivityTone, string> = {
    positive: 'border-l-emerald-500',
    change: 'border-l-blue-500',
    negative: 'border-l-red-500',
    output: 'border-l-amber-500',
    account: 'border-l-violet-500',
    neutral: 'border-l-border',
};

// Entries are stored in UTC and always shown in Philippine time.
const timeFormat = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
});

export default function ActivityLogs({
    logs,
    filters,
    modules,
    actions,
    users,
}: Props) {
    const [values, setValues] = useState<ActivityFilters>(filters);
    const filtered = Object.values(filters).some((value) => value !== '');

    const apply = (next: ActivityFilters) => {
        setValues(next);
        router.get(
            activityLogsIndex.url(),
            Object.fromEntries(
                Object.entries(next).filter(([, value]) => value !== ''),
            ),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const change = (key: keyof ActivityFilters, value: string) =>
        apply({ ...values, [key]: value });

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        apply(values);
    };

    return (
        <>
            <Head title="Activity logs" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Activity logs"
                    description="Who did what in SINOP, and when: sign-ins, changes, approvals, issuances and exports in every module. Times are Philippine time."
                />

                <div className="rounded-xl border bg-card">
                    <form
                        onSubmit={submitSearch}
                        className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
                        role="search"
                    >
                        <Filter label="Search" htmlFor="activity-search">
                            <Input
                                id="activity-search"
                                value={values.search}
                                onChange={(e) =>
                                    setValues({
                                        ...values,
                                        search: e.target.value,
                                    })
                                }
                                placeholder="Name, record or IP"
                            />
                        </Filter>
                        <Filter label="Action" htmlFor="activity-action">
                            <NativeSelect
                                id="activity-action"
                                value={values.action}
                                onChange={(e) =>
                                    change('action', e.target.value)
                                }
                            >
                                <option value="">All actions</option>
                                {actions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Filter>
                        <Filter label="Module" htmlFor="activity-module">
                            <NativeSelect
                                id="activity-module"
                                value={values.module}
                                onChange={(e) =>
                                    change('module', e.target.value)
                                }
                            >
                                <option value="">All modules</option>
                                {modules.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Filter>
                        <Filter label="User" htmlFor="activity-user">
                            <NativeSelect
                                id="activity-user"
                                value={values.user}
                                onChange={(e) => change('user', e.target.value)}
                            >
                                <option value="">Everyone</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </NativeSelect>
                        </Filter>
                        <Filter label="From" htmlFor="activity-from">
                            <Input
                                id="activity-from"
                                type="date"
                                value={values.from}
                                max={values.to || undefined}
                                onChange={(e) => change('from', e.target.value)}
                            />
                        </Filter>
                        <Filter label="To" htmlFor="activity-to">
                            <Input
                                id="activity-to"
                                type="date"
                                value={values.to}
                                min={values.from || undefined}
                                onChange={(e) => change('to', e.target.value)}
                            />
                        </Filter>
                        {/* Enter in the search box applies it. */}
                        <button type="submit" className="sr-only">
                            Apply filters
                        </button>
                    </form>
                    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
                        <span className="tabular-nums">
                            {formatNumber(logs.total)}{' '}
                            {logs.total === 1 ? 'entry' : 'entries'}
                        </span>
                        {filtered && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => apply(emptyFilters)}
                            >
                                Clear filters
                            </Button>
                        )}
                    </div>
                </div>

                {logs.data.length === 0 ? (
                    <div className="rounded-xl border bg-card">
                        <EmptyState
                            icon={History}
                            title={
                                filtered
                                    ? 'No entries match these filters'
                                    : 'No activity yet'
                            }
                            description={
                                filtered
                                    ? 'Try a different action, module, person or date.'
                                    : 'Sign-ins, changes, approvals and exports will appear here as they happen.'
                            }
                        />
                    </div>
                ) : (
                    <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[1.1875rem] before:w-px before:bg-border">
                        {logs.data.map((entry) => (
                            <ActivityItem key={entry.id} entry={entry} />
                        ))}
                    </ol>
                )}

                <DataPagination paginator={logs} />
            </div>
        </>
    );
}

ActivityLogs.layout = {
    breadcrumbs: [{ title: 'Activity logs', href: activityLogsIndex() }],
};

function Filter({
    label,
    htmlFor,
    children,
}: {
    label: string;
    htmlFor: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-1.5">
            <Label
                htmlFor={htmlFor}
                className="text-xs font-medium text-muted-foreground"
            >
                {label}
            </Label>
            {children}
        </div>
    );
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
    const items = Array.isArray(entry.properties?.items)
        ? (entry.properties.items as Record<string, unknown>[])
        : [];
    const details = Object.entries(entry.properties ?? {}).filter(
        ([key, value]) =>
            key !== 'items' &&
            value !== null &&
            value !== '' &&
            typeof value !== 'object',
    );
    const changes = Object.entries(entry.changes ?? {});
    const hasDetails =
        changes.length > 0 || items.length > 0 || details.length > 0;

    return (
        <li className="relative flex gap-4">
            <span
                aria-hidden
                className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-xs font-medium text-muted-foreground"
            >
                {initialsOf(entry.actor_name)}
            </span>

            <article
                className={cn(
                    'min-w-0 flex-1 rounded-xl border border-l-4 bg-card px-4 py-3',
                    accentTones[entry.tone],
                )}
            >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{entry.actor_name}</span>
                    {entry.actor_role_label && (
                        <span className="text-xs text-muted-foreground">
                            {entry.actor_role_label}
                        </span>
                    )}
                    <span
                        className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            badgeTones[entry.tone],
                        )}
                    >
                        {entry.action_label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        in {entry.module_label}
                    </span>
                </div>

                {(entry.subject_label || entry.summary) && (
                    <p className="mt-1.5 text-sm">
                        {entry.subject_label}
                        {entry.subject_label && entry.summary && (
                            <span className="text-muted-foreground"> · </span>
                        )}
                        {entry.summary && (
                            <span className="text-muted-foreground">
                                {entry.summary}
                            </span>
                        )}
                    </p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <Meta icon={Clock}>
                        <time dateTime={entry.created_at}>
                            {timeFormat.format(new Date(entry.created_at))}
                        </time>
                    </Meta>
                    {entry.department && (
                        <Meta icon={Building2}>{entry.department}</Meta>
                    )}
                    {entry.device && <Meta icon={Monitor}>{entry.device}</Meta>}
                    {entry.ip_address && (
                        <Meta icon={Globe}>{entry.ip_address}</Meta>
                    )}
                </div>

                {hasDetails && (
                    <details className="group mt-3 border-t pt-3">
                        <summary className="cursor-pointer text-xs font-medium text-primary select-none hover:underline">
                            <span className="group-open:hidden">
                                Show details
                            </span>
                            <span className="hidden group-open:inline">
                                Hide details
                            </span>
                        </summary>
                        <div className="mt-3 space-y-4">
                            {changes.length > 0 && (
                                <ChangesTable changes={changes} />
                            )}
                            {items.length > 0 && <ItemsTable items={items} />}
                            {details.length > 0 && (
                                <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                                    {details.map(([key, value]) => (
                                        <div key={key} className="flex gap-2">
                                            <dt className="text-muted-foreground">
                                                {fieldLabel(key)}
                                            </dt>
                                            <dd className="font-medium">
                                                {displayValue(value)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                        </div>
                    </details>
                )}
            </article>
        </li>
    );
}

function Meta({
    icon: Icon,
    children,
}: {
    icon: typeof Clock;
    children: ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Icon className="size-3.5" aria-hidden />
            {children}
        </span>
    );
}

function ChangesTable({
    changes,
}: {
    changes: [string, [unknown, unknown]][];
}) {
    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium">
                            Field
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                            Before
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                            After
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {changes.map(([field, [before, after]]) => (
                        <tr key={field}>
                            <td className="px-3 py-2 font-medium">
                                {fieldLabel(field)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground line-through decoration-muted-foreground/40">
                                {displayValue(before)}
                            </td>
                            <td className="px-3 py-2">{displayValue(after)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Item lines of an RIS or IAR entry; columns follow whatever the lines carry. */
function ItemsTable({ items }: { items: Record<string, unknown>[] }) {
    const columns = Array.from(
        new Set(items.flatMap((item) => Object.keys(item))),
    );

    return (
        <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column}
                                className={cn(
                                    'px-3 py-2 font-medium',
                                    column === 'item'
                                        ? 'text-left'
                                        : 'text-right',
                                )}
                            >
                                {fieldLabel(column)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {items.map((item, index) => (
                        <tr key={index}>
                            {columns.map((column) => (
                                <td
                                    key={column}
                                    className={cn(
                                        'px-3 py-2',
                                        column === 'item'
                                            ? 'text-left'
                                            : 'text-right tabular-nums',
                                    )}
                                >
                                    {displayValue(item[column])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const fieldNames: Record<string, string> = {
    department_id: 'Division',
    division: 'Division',
    designation_id: 'Designation',
    category_id: 'Category',
    supplier_id: 'Supplier',
    location_id: 'Location',
    user_id: 'Accountable officer',
    status: 'Status',
    stock_before: 'Stock before',
    stock_after: 'Stock after',
    unit_cost: 'Unit cost',
    fund_cluster: 'Fund cluster',
    received_by: 'Received by',
    is_active: 'Active',
};

function fieldLabel(key: string): string {
    if (fieldNames[key]) {
        return fieldNames[key];
    }

    const words = key.replace(/_id$/, '').replace(/_/g, ' ');

    return words.charAt(0).toUpperCase() + words.slice(1);
}

function displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    if (typeof value === 'number') {
        return value.toLocaleString('en-PH', { maximumFractionDigits: 4 });
    }

    if (typeof value === 'string') {
        // ISO dates and date-times read as dates.
        if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
            const date = new Date(value);

            if (!Number.isNaN(date.getTime())) {
                return value.length === 10
                    ? date.toLocaleDateString('en-PH', { dateStyle: 'medium' })
                    : timeFormat.format(date);
            }
        }

        return value;
    }

    return JSON.stringify(value);
}
