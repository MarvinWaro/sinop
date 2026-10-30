import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { getJson } from '@/lib/http';
import { listen, onLiveStatus } from '@/lib/realtime';
import type { LiveStatus } from '@/lib/realtime';
import { index, open, recent } from '@/routes/notifications';
import type { BroadcastingConfig, NotificationPage } from '@/types';
import type { AppNotification } from '@/types/notifications';

/** Check every minute when live updates are off or down… */
const POLL_MS = 60_000;
/** …and every five minutes as a safety net while they work. */
const POLL_LIVE_MS = 300_000;
/** A burst of signals reloads once. */
const SETTLE_MS = 400;

// The bell's panel is open: arrivals show there instead of as a toast.
let panelOpen = false;

export function setInboxPanelOpen(open: boolean): void {
    panelOpen = open;
}

/** The notification as one line of text, for toasts and desktop pop-ups. */
export function notificationText(notification: AppNotification): string {
    const { before, subject, after } = notification.sentence;

    return [notification.actor?.name, before, subject, after]
        .filter(Boolean)
        .join(' ');
}

// Props of the page on screen that change with the person's notifications
// (its own lists, e.g. "My requests"); see useLiveProps.
const liveProps = new Map<string, number>();

/**
 * Refresh these props of the current page whenever the person's
 * notifications change, e.g. a request's status after the CAO approves it.
 */
export function useLiveProps(props: string[]): void {
    const key = props.join(',');

    useEffect(() => {
        const names = key.split(',').filter(Boolean);
        names.forEach((name) =>
            liveProps.set(name, (liveProps.get(name) ?? 0) + 1),
        );

        return () =>
            names.forEach((name) => {
                const left = (liveProps.get(name) ?? 1) - 1;

                if (left > 0) {
                    liveProps.set(name, left);
                } else {
                    liveProps.delete(name);
                }
            });
    }, [key]);
}

/**
 * Reload the bell's count, the sidebar badges and the page's own live props
 * in one request, without interrupting anything the person is doing.
 */
function refreshInbox(): void {
    router.reload({
        only: ['inbox', 'notifications', ...liveProps.keys()],
        async: true,
    });
}

/**
 * Keeps the bell and the sidebar badges current: on each live `inbox`
 * signal (Berth's Soketi app), and by checking now and then. A hidden tab
 * doesn't check; it catches up once when it's shown again. Mounted once,
 * in the app layout.
 */
export function useInboxUpdates(): void {
    const { broadcasting } = usePage().props;
    const config = useLiveConfig(broadcasting);

    useEffect(() => {
        let live: LiveStatus = 'unavailable';
        let stale = false;
        let lastCheck = Date.now();
        let settle = 0;

        const check = () => {
            if (document.visibilityState === 'hidden') {
                stale = true;

                return;
            }

            stale = false;
            lastCheck = Date.now();
            refreshInbox();
        };

        const signal = () => {
            window.clearTimeout(settle);
            settle = window.setTimeout(check, SETTLE_MS);
        };

        const poll = window.setInterval(() => {
            const every = live === 'connected' ? POLL_LIVE_MS : POLL_MS;

            if (Date.now() - lastCheck >= every) {
                check();
            }
        }, POLL_MS);

        const onVisible = () => {
            if (document.visibilityState === 'visible' && stale) {
                check();
            }
        };

        document.addEventListener('visibilitychange', onVisible);

        const stopListening = config
            ? listen(config, config.channel, 'inbox', signal)
            : () => {};
        const stopStatus = config
            ? onLiveStatus(config, (status) => {
                  live = status;

                  if (
                      status === 'connected' &&
                      'Notification' in window &&
                      Notification.permission === 'default'
                  ) {
                      void Notification.requestPermission();
                  }
              })
            : () => {};

        return () => {
            window.clearTimeout(settle);
            window.clearInterval(poll);
            document.removeEventListener('visibilitychange', onVisible);
            stopListening();
            stopStatus();
        };
    }, [config]);

    useArrivalToasts();
}

/** The broadcasting prop, kept stable across page visits while unchanged. */
function useLiveConfig(
    broadcasting: BroadcastingConfig | null,
): BroadcastingConfig | null {
    const enabled = Boolean(broadcasting?.enabled && broadcasting.key);
    const key = broadcasting?.key ?? null;
    const cluster = broadcasting?.cluster ?? null;
    const host = broadcasting?.host ?? null;
    const port = broadcasting?.port ?? 443;
    const scheme = broadcasting?.scheme ?? 'https';
    const channel = broadcasting?.channel ?? '';

    return useMemo(
        () =>
            enabled && channel
                ? { enabled, key, cluster, host, port, scheme, channel }
                : null,
        [enabled, key, cluster, host, port, scheme, channel],
    );
}

/**
 * When a new notification arrives, show it as a toast with an Open button
 * (and a desktop pop-up while the tab is hidden). Quiet while the bell's
 * panel or the Notifications page shows it already.
 */
function useArrivalToasts(): void {
    const { inbox } = usePage().props;
    const latestAt = inbox?.latest_at ?? null;
    const seen = useRef(latestAt);

    useEffect(() => {
        const previous = seen.current;
        seen.current = latestAt;

        if (
            latestAt === null ||
            previous === null ||
            latestAt <= previous ||
            panelOpen ||
            window.location.pathname.startsWith(index.url())
        ) {
            return;
        }

        void getJson<NotificationPage>(recent.url())
            .then((page) => {
                const arrived = page.data.filter(
                    (item) =>
                        item.read_at === null && item.created_at > previous,
                );

                if (arrived.length === 0) {
                    return;
                }

                const [newest] = arrived;
                const title =
                    arrived.length === 1
                        ? notificationText(newest)
                        : `${arrived.length} new notifications`;

                toast.info(title, {
                    description:
                        arrived.length === 1 ? newest.kind.label : undefined,
                    duration: 8000,
                    action: {
                        label: 'Open',
                        onClick: () =>
                            router.visit(
                                arrived.length === 1
                                    ? open.url(newest.id)
                                    : index.url(),
                            ),
                    },
                });

                if (
                    document.hidden &&
                    'Notification' in window &&
                    Notification.permission === 'granted'
                ) {
                    new Notification('SINOP', {
                        body: title,
                        icon: '/img/ched-logo.png',
                    });
                }
            })
            .catch(() => {
                // The bell's count is already right; the toast is a nicety.
            });
    }, [latestAt]);
}
