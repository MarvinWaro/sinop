import { Link, router, usePage } from '@inertiajs/react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    NotificationItem,
    NotificationSkeleton,
} from '@/components/notifications/notification-item';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { setInboxPanelOpen } from '@/hooks/use-inbox';
import { getJson, postJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import { index, readAll, recent } from '@/routes/notifications';
import type { AppNotification, Inbox, NotificationPage } from '@/types';

/** "3", or "9+" when there are more. */
export function badgeLabel(count: number): string {
    return count > 9 ? '9+' : String(count);
}

/** New items first, then the ones already shown (by id). */
function merge(
    incoming: AppNotification[],
    current: AppNotification[],
): AppNotification[] {
    const ids = new Set(incoming.map((item) => item.id));

    return [...incoming, ...current.filter((item) => !ids.has(item.id))];
}

/**
 * The bell's list: loaded when the panel opens, refreshed when something
 * new arrives while it's open, and five more at a time when scrolled down.
 */
function useNotificationPanel(open: boolean, latestAt: string | null) {
    const [items, setItems] = useState<AppNotification[]>([]);
    const [cursor, setCursor] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [loaded, setLoaded] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    // Read inside the fetch: the first load replaces, later ones merge.
    const loadedOnce = useRef(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        let cancelled = false;
        setStatus('loading');

        getJson<NotificationPage>(recent.url())
            .then((page) => {
                if (cancelled) {
                    return;
                }

                const first = !loadedOnce.current;
                setItems((current) =>
                    first ? page.data : merge(page.data, current),
                );

                if (first) {
                    setCursor(page.meta.next_cursor);
                }

                loadedOnce.current = true;
                setLoaded(true);
                setStatus('idle');
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus('error');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, latestAt]);

    const loadMore = useCallback(() => {
        if (!cursor || loadingMore) {
            return;
        }

        setLoadingMore(true);
        getJson<NotificationPage>(recent.url(), { cursor })
            .then((page) => {
                setItems((current) => [
                    ...current,
                    ...page.data.filter(
                        (item) => !current.some((seen) => seen.id === item.id),
                    ),
                ]);
                setCursor(page.meta.next_cursor);
            })
            .catch(() => toast.error('Could not load more notifications.'))
            .finally(() => setLoadingMore(false));
    }, [cursor, loadingMore]);

    return { items, setItems, status, loaded, cursor, loadingMore, loadMore };
}

/** Header bell: unread count, and the newest notifications in a panel. */
export function NotificationBell() {
    const { inbox } = usePage().props;
    const unread = inbox?.unread ?? 0;
    const [open, setOpen] = useState(false);
    const panel = useNotificationPanel(open, inbox?.latest_at ?? null);
    const sentinel = useRef<HTMLDivElement>(null);
    const { loadMore } = panel;

    useEffect(() => {
        setInboxPanelOpen(open);

        return () => setInboxPanelOpen(false);
    }, [open]);

    // Load five more when the end of the list scrolls into view.
    useEffect(() => {
        const element = sentinel.current;

        if (!open || !element || !panel.cursor) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    loadMore();
                }
            },
            { rootMargin: '120px' },
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, [open, panel.cursor, loadMore]);

    const markAllRead = () => {
        postJson<{ inbox: Inbox }>(readAll.url())
            .then((data) => {
                router.replaceProp('inbox', data.inbox);
                const now = new Date().toISOString();
                panel.setItems((items) =>
                    items.map((item) => ({
                        ...item,
                        read_at: item.read_at ?? now,
                    })),
                );
            })
            .catch(() => toast.error('Could not mark them as read.'));
    };

    const label =
        unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative size-9"
                            aria-label={label}
                        >
                            <Bell className="size-5" />
                            {unread > 0 && (
                                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
                                    {badgeLabel(unread)}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
            </Tooltip>

            <PopoverContent
                align="end"
                collisionPadding={8}
                className="flex w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden p-0"
            >
                <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                    <p className="font-semibold">Notifications</p>
                    {unread > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={markAllRead}
                        >
                            <CheckCheck className="size-3.5" />
                            Mark all as read
                        </Button>
                    )}
                </div>

                <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
                    {!panel.loaded && panel.status === 'loading' ? (
                        <>
                            <NotificationSkeleton />
                            <NotificationSkeleton />
                            <NotificationSkeleton />
                        </>
                    ) : panel.status === 'error' && !panel.loaded ? (
                        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                            Notifications couldn&apos;t be loaded. Try again in
                            a moment.
                        </p>
                    ) : panel.items.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                            <BellOff className="size-6 text-muted-foreground" />
                            <p className="text-sm font-medium">
                                No notifications yet
                            </p>
                            <p className="text-xs text-muted-foreground">
                                You&apos;ll be told here when something needs
                                you.
                            </p>
                        </div>
                    ) : (
                        <ul
                            aria-label="Notifications, newest first"
                            className="divide-y"
                        >
                            {panel.items.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    compact
                                    onChange={(next) =>
                                        panel.setItems((items) =>
                                            items.map((item) =>
                                                item.id === next.id
                                                    ? next
                                                    : item,
                                            ),
                                        )
                                    }
                                    onRemove={(id) =>
                                        panel.setItems((items) =>
                                            items.filter(
                                                (item) => item.id !== id,
                                            ),
                                        )
                                    }
                                />
                            ))}
                        </ul>
                    )}
                    <div ref={sentinel} aria-hidden />
                    {panel.loadingMore && <NotificationSkeleton />}
                </div>

                <Link
                    href={index.url()}
                    onClick={() => setOpen(false)}
                    className={cn(
                        'border-t px-4 py-3 text-center text-sm font-medium transition-colors hover:bg-muted/60',
                    )}
                >
                    View all notifications
                </Link>
            </PopoverContent>
        </Popover>
    );
}
