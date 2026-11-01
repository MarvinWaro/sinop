import { Link } from '@inertiajs/react';
import { X } from 'lucide-react';
import { NotificationMark } from '@/components/notifications/notification-item';
import { formatDayDateTime } from '@/lib/format';
import { toast } from '@/lib/toast';
import { open } from '@/routes/notifications';
import type { AppNotification } from '@/types';

/**
 * A new notification as a card at the bottom of the screen, like Facebook's:
 * the person's photo or initials with the kind's icon, what they did and
 * when. The whole card opens it.
 */
export function showNotificationToast(notification: AppNotification): void {
    toast.custom(
        (id) => (
            <NotificationToast
                notification={notification}
                onDismiss={() => toast.dismiss(id)}
            />
        ),
        { duration: 8000 },
    );
}

function NotificationToast({
    notification,
    onDismiss,
}: {
    notification: AppNotification;
    onDismiss: () => void;
}) {
    const { before, subject, after } = notification.sentence;

    return (
        <div className="relative flex w-(--width) gap-3 rounded-xl border bg-popover p-3 pr-9 text-popover-foreground shadow-lg">
            <NotificationMark notification={notification} />
            <Link
                href={open.url(notification.id)}
                onClick={onDismiss}
                className="min-w-0 flex-1 outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
                <span className="line-clamp-3 text-sm leading-snug text-pretty">
                    {notification.actor && (
                        <span className="font-semibold">
                            {notification.actor.name}
                        </span>
                    )}{' '}
                    {before}{' '}
                    {subject && (
                        <span className="font-semibold">{subject}</span>
                    )}
                    {after && ` ${after}`}
                </span>
                <span className="mt-1 block text-xs">
                    <span className="font-medium text-primary">Just now</span>
                    <span className="text-muted-foreground">
                        {' · '}
                        {formatDayDateTime(notification.created_at)}
                    </span>
                </span>
            </Link>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="absolute top-2 right-2 z-10 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
                <X className="size-3.5" />
            </button>
        </div>
    );
}
