import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { useCan } from '@/hooks/use-can';

/**
 * Real-time requisition notifications over Pusher (same channels and events
 * as the Jetstream layout script). Enabled when BROADCAST_CONNECTION=pusher
 * and the Pusher keys are configured; otherwise this is a no-op.
 */

type PusherChannel = {
    bind: (
        event: string,
        callback: (data: Record<string, unknown>) => void,
    ) => void;
};

type PusherInstance = {
    subscribe: (channel: string) => PusherChannel;
    unsubscribe: (channel: string) => void;
    disconnect: () => void;
};

type PusherConstructor = new (
    key: string,
    options: Record<string, unknown>,
) => PusherInstance;

declare global {
    interface Window {
        Pusher?: PusherConstructor;
    }
}

const PUSHER_SRC = 'https://js.pusher.com/8.2.0/pusher.min.js';

let pusherScript: Promise<PusherConstructor> | null = null;

function loadPusher(): Promise<PusherConstructor> {
    if (window.Pusher) {
        return Promise.resolve(window.Pusher);
    }

    pusherScript ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = PUSHER_SRC;
        script.async = true;
        script.onload = () =>
            window.Pusher
                ? resolve(window.Pusher)
                : reject(new Error('Pusher failed to load'));
        script.onerror = () => reject(new Error('Pusher failed to load'));
        document.head.appendChild(script);
    });

    return pusherScript;
}

function xsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1] ?? '') : '';
}

function notify(
    title: string,
    body: string,
    type: 'success' | 'info' | 'error' = 'info',
) {
    toast[type](title, { description: body });

    if (
        'Notification' in window &&
        Notification.permission === 'granted' &&
        document.hidden
    ) {
        new Notification(title, { body, icon: '/img/ched-logo.png' });
    }
}

function refreshBadges() {
    router.reload({ only: ['notifications'] });
}

function text(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

export function useRealtimeNotifications(): void {
    const { auth, broadcasting } = usePage().props;
    const userId = auth.user?.id;
    const can = useCan();
    // Issuers hear about approved requests; approvers (who don't issue) about new ones.
    const channel = can('ris.issue')
        ? 'admin'
        : can('ris.approve')
          ? 'cao'
          : null;
    const enabled = broadcasting?.enabled && broadcasting.key;

    useEffect(() => {
        if (!enabled || !userId || !broadcasting.key) {
            return;
        }

        let pusher: PusherInstance | null = null;
        let cancelled = false;

        loadPusher()
            .then((Pusher) => {
                if (cancelled) {
                    return;
                }

                pusher = new Pusher(broadcasting.key as string, {
                    cluster: broadcasting.cluster ?? undefined,
                    forceTLS: true,
                    authEndpoint: '/broadcasting/auth',
                    auth: {
                        headers: {
                            'X-XSRF-TOKEN': xsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                });

                if (
                    'Notification' in window &&
                    Notification.permission === 'default'
                ) {
                    void Notification.requestPermission();
                }

                if (channel === 'cao') {
                    pusher
                        .subscribe('private-cao-notifications')
                        .bind(
                            'App\\Events\\RequisitionStatusUpdated',
                            (data) => {
                                refreshBadges();

                                if (data.action === 'created') {
                                    notify(
                                        'New requisition request',
                                        `${text(data.requester_name, 'A user')} submitted requisition ${text(data.ris_no)}`,
                                    );
                                }
                            },
                        );
                } else if (channel === 'admin') {
                    pusher
                        .subscribe('private-admin-notifications')
                        .bind(
                            'App\\Events\\RequisitionStatusUpdated',
                            (data) => {
                                refreshBadges();

                                if (data.action === 'approved') {
                                    notify(
                                        'Requisition approved',
                                        `Requisition ${text(data.ris_no)} is ready for issuance`,
                                        'success',
                                    );
                                } else if (data.action === 'completed') {
                                    notify(
                                        'Supplies received',
                                        `Supplies for ${text(data.ris_no)} have been received`,
                                        'success',
                                    );
                                }
                            },
                        );
                } else {
                    pusher
                        .subscribe(`private-user.${userId}`)
                        .bind(
                            'App\\Events\\UserNotificationUpdated',
                            (data) => {
                                refreshBadges();

                                const notification = (data.notification ??
                                    {}) as {
                                    type?: string;
                                    data?: Record<string, unknown>;
                                };
                                const risNo = text(notification.data?.ris_no);

                                switch (notification.type) {
                                    case 'requisition_approved':
                                        notify(
                                            'Request approved!',
                                            `Your requisition ${risNo} has been approved`,
                                            'success',
                                        );
                                        break;
                                    case 'supplies_ready':
                                        notify(
                                            'Supplies ready!',
                                            `Supplies for ${risNo} are ready for pickup`,
                                        );
                                        break;
                                    case 'requisition_declined':
                                        notify(
                                            'Request declined',
                                            `Your requisition was declined: ${text(notification.data?.reason, 'No reason provided')}`,
                                            'error',
                                        );
                                        break;
                                    case 'supplies_received':
                                        notify(
                                            'Supplies received',
                                            `Supplies for ${risNo} have been received`,
                                            'success',
                                        );
                                        break;
                                }
                            },
                        );
                }
            })
            .catch(() => {
                // Realtime is optional; the badges still update on navigation.
            });

        return () => {
            cancelled = true;
            pusher?.disconnect();
        };
    }, [enabled, userId, channel, broadcasting.key, broadcasting.cluster]);
}
