import { Head, InfiniteScroll, router, usePage } from '@inertiajs/react';
import { BellOff, CheckCheck, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { EmptyState } from '@/components/empty-state';
import { FormSelect } from '@/components/form-select';
import {
    NotificationItem,
    NotificationSkeleton,
} from '@/components/notifications/notification-item';
import { PageContainer, PageHeader } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import { index, readAll } from '@/routes/notifications';
import type { AppNotification, Inbox, NotificationFilters } from '@/types';

type Option = { value: string; label: string };

type Props = {
    notifications: { data: AppNotification[] };
    filters: NotificationFilters;
    kinds: Option[];
    modules: Option[];
};

/** Wait this long after typing before searching. */
const SEARCH_DELAY_MS = 350;

/** "You're all caught up" or "You have 3 unread notifications". */
export function unreadSentence(unread: number): string {
    return unread === 0
        ? "You're all caught up"
        : `You have ${unread} unread notification${unread === 1 ? '' : 's'}`;
}

/** Change one listed notification without asking the server again. */
function replaceItems(
    update: (items: AppNotification[]) => AppNotification[],
): void {
    router.replaceProp('notifications.data', (items: unknown) =>
        update(items as AppNotification[]),
    );
}

export default function Notifications({
    notifications,
    filters,
    kinds,
    modules,
}: Props) {
    const { inbox } = usePage().props;
    const unread = inbox?.unread ?? 0;
    const [values, setValues] = useState<NotificationFilters>(filters);
    const [loading, setLoading] = useState(false);
    const searchTimer = useRef(0);

    // Something arrived while this page is open: offer to show it.
    const latestAt = inbox?.latest_at ?? null;
    const seenLatest = useRef(latestAt);
    const [hasNew, setHasNew] = useState(false);

    useEffect(() => {
        if (latestAt && seenLatest.current && latestAt > seenLatest.current) {
            setHasNew(true);
        }

        seenLatest.current = latestAt;
    }, [latestAt]);

    useEffect(() => () => window.clearTimeout(searchTimer.current), []);

    const apply = (next: NotificationFilters) => {
        setValues(next);
        setHasNew(false);
        router.get(
            index.url(),
            Object.fromEntries(
                Object.entries(next).filter(([, value]) => value !== ''),
            ),
            {
                only: ['notifications', 'filters', 'kinds', 'modules'],
                reset: ['notifications'],
                preserveState: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };

    const search = (text: string) => {
        setValues((current) => ({ ...current, search: text }));
        window.clearTimeout(searchTimer.current);
        searchTimer.current = window.setTimeout(
            () => apply({ ...values, search: text }),
            SEARCH_DELAY_MS,
        );
    };

    const showNew = () => {
        apply(values);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const markAllRead = () => {
        postJson<{ inbox: Inbox }>(readAll.url())
            .then((data) => {
                router.replaceProp('inbox', data.inbox);

                if (values.status === 'unread') {
                    apply(values);
                } else {
                    const now = new Date().toISOString();
                    replaceItems((items) =>
                        items.map((item) => ({
                            ...item,
                            read_at: item.read_at ?? now,
                        })),
                    );
                }
            })
            .catch(() => toast.error('Could not mark them as read.'));
    };

    const narrowed = Boolean(values.search || values.kind || values.module);
    const items = notifications.data;

    return (
        <>
            <Head title="Notifications" />
            <PageContainer className="mx-auto w-full max-w-3xl">
                <PageHeader
                    title="Notifications"
                    description={unreadSentence(unread)}
                    actions={
                        <Button
                            variant="outline"
                            onClick={markAllRead}
                            disabled={unread === 0}
                        >
                            <CheckCheck />
                            Mark all as read
                        </Button>
                    }
                />

                <div className="space-y-4">
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={values.status === 'unread' ? 'unread' : 'all'}
                        onValueChange={(value: string) =>
                            value &&
                            apply({
                                ...values,
                                status: value === 'unread' ? 'unread' : '',
                            })
                        }
                        aria-label="Show"
                    >
                        <ToggleGroupItem value="all" className="px-4">
                            All
                        </ToggleGroupItem>
                        <ToggleGroupItem value="unread" className="gap-2 px-4">
                            Unread
                            {unread > 0 && (
                                <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 font-semibold text-primary-foreground tabular-nums">
                                    {unread}
                                </span>
                            )}
                        </ToggleGroupItem>
                    </ToggleGroup>

                    <div className="overflow-hidden rounded-xl border bg-card">
                        {kinds.length > 0 && (
                            <div className="grid gap-3 border-b p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                                <SearchInput
                                    value={values.search}
                                    onValueChange={search}
                                    onClear={() =>
                                        apply({ ...values, search: '' })
                                    }
                                    placeholder="Name or record"
                                    aria-label="Search notifications"
                                />
                                <FormSelect
                                    value={values.kind}
                                    onValueChange={(kind) =>
                                        apply({ ...values, kind })
                                    }
                                    aria-label="Type"
                                    options={[
                                        { value: '', label: 'All types' },
                                        ...kinds,
                                    ]}
                                />
                                <FormSelect
                                    value={values.module}
                                    onValueChange={(module) =>
                                        apply({ ...values, module })
                                    }
                                    aria-label="Module"
                                    options={[
                                        { value: '', label: 'All modules' },
                                        ...modules,
                                    ]}
                                />
                            </div>
                        )}

                        {hasNew && (
                            <button
                                type="button"
                                onClick={showNew}
                                className="sticky top-20 z-10 mx-auto my-2 flex rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-md"
                            >
                                New notifications · Show
                            </button>
                        )}

                        <div
                            aria-busy={loading}
                            className={cn(
                                'transition-opacity',
                                loading && 'opacity-60',
                            )}
                        >
                            {items.length === 0 ? (
                                <EmptyState
                                    className="border-0"
                                    icon={narrowed ? SearchX : BellOff}
                                    title={
                                        narrowed
                                            ? 'No notifications match'
                                            : values.status === 'unread'
                                              ? "You're all caught up"
                                              : 'No notifications yet'
                                    }
                                    description={
                                        narrowed
                                            ? 'Try another search, type or module.'
                                            : "You'll be told here when something needs you, like a requisition to approve or supplies to receive."
                                    }
                                    action={
                                        narrowed && (
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    apply({
                                                        ...values,
                                                        search: '',
                                                        kind: '',
                                                        module: '',
                                                    })
                                                }
                                            >
                                                Clear filters
                                            </Button>
                                        )
                                    }
                                />
                            ) : (
                                <InfiniteScroll
                                    data="notifications"
                                    preserveUrl
                                    buffer={600}
                                    next={({ loading: more, hasMore }) =>
                                        more ? (
                                            <NotificationSkeleton />
                                        ) : (
                                            !hasMore && (
                                                <p className="border-t py-5 text-center text-sm text-muted-foreground">
                                                    No older notifications
                                                </p>
                                            )
                                        )
                                    }
                                >
                                    <ul
                                        aria-label="Notifications, newest first"
                                        className="divide-y"
                                    >
                                        {items.map((notification) => (
                                            <NotificationItem
                                                key={notification.id}
                                                notification={notification}
                                                onChange={(next) =>
                                                    replaceItems((list) =>
                                                        values.status ===
                                                            'unread' &&
                                                        next.read_at
                                                            ? list.filter(
                                                                  (item) =>
                                                                      item.id !==
                                                                      next.id,
                                                              )
                                                            : list.map(
                                                                  (item) =>
                                                                      item.id ===
                                                                      next.id
                                                                          ? next
                                                                          : item,
                                                              ),
                                                    )
                                                }
                                                onRemove={(id) =>
                                                    replaceItems((list) =>
                                                        list.filter(
                                                            (item) =>
                                                                item.id !== id,
                                                        ),
                                                    )
                                                }
                                            />
                                        ))}
                                    </ul>
                                </InfiniteScroll>
                            )}
                        </div>
                    </div>
                </div>
            </PageContainer>
        </>
    );
}

Notifications.layout = {
    breadcrumbs: [{ title: 'Notifications', href: index() }],
};
