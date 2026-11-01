import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef } from 'react';
import { showNotificationToast } from '@/components/notifications/notification-toast';
import { toast } from '@/lib/toast';
import { getJson } from '@/lib/http';
import { listen, onLiveStatus } from '@/lib/realtime';
import type { LiveStatus } from '@/lib/realtime';
import { index, recent } from '@/routes/notifications';
import type {
    BroadcastingConfig,
    MessagesSignal,
    NotificationPage,
    TypingSignal,
} from '@/types';
import type { AppNotification } from '@/types/notifications';

/** Check every minute when live updates are off or down… */
const POLL_MS = 60_000;
/** …and every five minutes as a safety net while they work. */
const POLL_LIVE_MS = 300_000;
/** A burst of signals reloads once. */
const SETTLE_MS = 400;
/** Up to this many new notifications pop up one card each. */
const MAX_CARDS = 3;

/**
 * Window events for the Messages page: `MESSAGES_EVENT` when a conversation
 * has news (detail: `{ conversation }`, or nothing when anything may have
 * changed), `TYPING_EVENT` when someone types (detail: `{ conversation, name }`).
 */
export const MESSAGES_EVENT = 'sinop:messages';
export const TYPING_EVENT = 'sinop:typing';

function announce(name: string, detail?: unknown): void {
    window.dispatchEvent(new CustomEvent(name, { detail }));
}

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
 * Reload the bell's count, the sidebar badges, the Messages badge and the
 * page's own live props in one request, without interrupting anything the
 * person is doing.
 */
function refreshInbox(): void {
    router.reload({
        only: ['inbox', 'notifications', 'messagesUnread', ...liveProps.keys()],
        async: true,
    });
}

/**
 * Keeps the bell, the sidebar badges and Messages current: on each live
 * `inbox`, `messages` or `typing` signal (Berth's Soketi app), and by
 * checking now and then. A hidden tab
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

        // `everything`: a check that may have missed messages too (polls,
        // coming back to the tab), so the Messages page looks again.
        const check = (everything = false) => {
            if (document.visibilityState === 'hidden') {
                stale = true;

                return;
            }

            if (everything || stale) {
                announce(MESSAGES_EVENT);
            }

            stale = false;
            lastCheck = Date.now();
            refreshInbox();
        };

        const signal = () => {
            window.clearTimeout(settle);
            settle = window.setTimeout(check, SETTLE_MS);
        };

        const onMessages = (data?: unknown) => {
            announce(MESSAGES_EVENT, data as MessagesSignal);
            signal();
        };

        const onTyping = (data?: unknown) => {
            if (data) {
                announce(TYPING_EVENT, data as TypingSignal);
            }
        };

        const poll = window.setInterval(() => {
            const every = live === 'connected' ? POLL_LIVE_MS : POLL_MS;

            if (Date.now() - lastCheck >= every) {
                check(true);
            }
        }, POLL_MS);

        const onVisible = () => {
            if (document.visibilityState === 'visible' && stale) {
                check();
            }
        };

        document.addEventListener('visibilitychange', onVisible);

        const stops = config
            ? [
                  listen(config, config.channel, 'inbox', signal),
                  listen(config, config.channel, 'messages', onMessages),
                  listen(config, config.channel, 'typing', onTyping),
              ]
            : [];
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
            stops.forEach((stop) => stop());
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
 * When new notifications arrive, pop each up as a card with the person's
 * avatar (a few at most; more become one "N new notifications" toast), and
 * a desktop pop-up while the tab is hidden. Quiet while the bell's panel or
 * the Notifications page shows them already.
 */
function useArrivalToasts(): void {
    const { inbox } = usePage().props;
    const latestAt = inbox?.latest_at ?? null;
    const seen = useRef(latestAt);

    useEffect(() => {
        const previous = seen.current;
        seen.current = latestAt;

        // No `previous` means there were none before: all unread ones are new.
        if (
            latestAt === null ||
            (previous !== null && latestAt <= previous) ||
            panelOpen ||
            window.location.pathname.startsWith(index.url())
        ) {
            return;
        }

        void getJson<NotificationPage>(recent.url())
            .then((page) => {
                const arrived = page.data.filter(
                    (item) =>
                        item.read_at === null &&
                        (previous === null || item.created_at > previous),
                );

                if (arrived.length === 0) {
                    return;
                }

                const [newest] = arrived;
                const title =
                    arrived.length === 1
                        ? notificationText(newest)
                        : `${arrived.length} new notifications`;

                if (arrived.length <= MAX_CARDS) {
                    // Oldest first, so the newest ends up in front.
                    [...arrived].reverse().forEach(showNotificationToast);
                } else {
                    toast.info(title, {
                        duration: 8000,
                        action: {
                            label: 'Open',
                            onClick: () => router.visit(index.url()),
                        },
                    });
                }

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
