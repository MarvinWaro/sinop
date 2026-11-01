import { Link, router } from '@inertiajs/react';
import {
    BadgeCheck,
    Bell,
    CircleCheck,
    CircleX,
    ClipboardList,
    Ellipsis,
    Laptop,
    MailCheck,
    MailOpen,
    PackageCheck,
    PackageOpen,
    PackageX,
    Trash2,
    TriangleAlert,
    Truck,
    UserCheck,
    UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative, initialsOf } from '@/lib/format';
import { deleteJson, patchJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import { destroy, open, update } from '@/routes/notifications';
import type { AppNotification, Inbox, NotificationTone } from '@/types';

const kindIcons: Record<string, LucideIcon> = {
    ris_submitted: ClipboardList,
    ris_approved: BadgeCheck,
    ris_ready_to_issue: PackageOpen,
    ris_declined: CircleX,
    ris_issued: PackageCheck,
    ris_received: CircleCheck,
    stock_low: TriangleAlert,
    stock_out: PackageX,
    iar_recorded: Truck,
    account_requested: UserPlus,
    account_activated: UserCheck,
    property_assigned: Laptop,
};

const tones: Record<NotificationTone, { solid: string; soft: string }> = {
    positive: {
        solid: 'bg-emerald-600 text-white',
        soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    info: {
        solid: 'bg-primary text-primary-foreground',
        soft: 'bg-primary/10 text-primary',
    },
    warning: {
        solid: 'bg-amber-500 text-white',
        soft: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    danger: {
        solid: 'bg-red-600 text-white',
        soft: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    },
};

type Props = {
    notification: AppNotification;
    /** The bell's panel: shorter text, no module. */
    compact?: boolean;
    onChange: (notification: AppNotification) => void;
    onRemove: (id: string) => void;
};

/** Update the bell's count from a server answer. */
function setInbox(inbox: Inbox): void {
    router.replaceProp('inbox', inbox);
}

/**
 * One notification: who did what, when, and a ⋯ menu to mark it read or
 * unread or delete it. The whole row opens it (marking it read).
 */
export function NotificationItem({
    notification,
    compact = false,
    onChange,
    onRemove,
}: Props) {
    const [busy, setBusy] = useState(false);
    const unread = notification.read_at === null;
    const { before, subject, after } = notification.sentence;

    const setRead = (read: boolean) => {
        setBusy(true);
        patchJson<{ notification: AppNotification; inbox: Inbox }>(
            update.url(notification.id),
            { read },
        )
            .then((data) => {
                setInbox(data.inbox);
                onChange(data.notification);
            })
            .catch(() => toast.error('Could not update the notification.'))
            .finally(() => setBusy(false));
    };

    const remove = () => {
        setBusy(true);
        deleteJson<{ inbox: Inbox }>(destroy.url(notification.id))
            .then((data) => {
                setInbox(data.inbox);
                onRemove(notification.id);
            })
            .catch(() => {
                toast.error('Could not delete the notification.');
                setBusy(false);
            });
    };

    return (
        <li
            className={cn(
                'group relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60',
                unread && 'bg-primary/5',
                busy && 'opacity-60',
            )}
        >
            <NotificationMark notification={notification} />

            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'text-sm leading-snug text-pretty',
                        compact && 'line-clamp-3',
                    )}
                >
                    <Link
                        href={open.url(notification.id)}
                        className="outline-none after:absolute after:inset-0 focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
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
                    </Link>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    {/* "5 min ago" depends on when it's rendered (server vs browser). */}
                    <time
                        dateTime={notification.created_at}
                        title={formatDateTime(notification.created_at)}
                        className={cn(unread && 'font-medium text-primary')}
                        suppressHydrationWarning
                    >
                        {formatRelative(notification.created_at)}
                    </time>
                    {!compact && ` · ${notification.module.label}`}
                </p>
            </div>

            {/* Above the row's link, so the menu stays clickable. */}
            <div className="relative z-10 flex shrink-0 items-start gap-1.5">
                <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            aria-label="Notification options"
                            disabled={busy}
                        >
                            <Ellipsis className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => setRead(unread)}>
                            {unread ? <MailCheck /> : <MailOpen />}
                            {unread ? 'Mark as read' : 'Mark as unread'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onSelect={remove}
                        >
                            <Trash2 />
                            Delete notification
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <span
                    className={cn(
                        'mt-2.5 size-2 rounded-full',
                        unread ? 'bg-primary' : 'bg-transparent',
                    )}
                    aria-label={unread ? 'Unread' : undefined}
                />
            </div>
        </li>
    );
}

/** The actor's photo or initials with a small icon for the kind. */
export function NotificationMark({
    notification,
}: {
    notification: AppNotification;
}) {
    const Icon = kindIcons[notification.kind.code] ?? Bell;
    const tone = tones[notification.kind.tone] ?? tones.info;

    if (!notification.actor) {
        return (
            <span
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    tone.soft,
                )}
            >
                <Icon className="size-5" />
            </span>
        );
    }

    return (
        <span className="relative size-10 shrink-0">
            <Avatar className="size-10">
                {notification.actor.avatar && (
                    <AvatarImage
                        src={notification.actor.avatar}
                        alt=""
                        className="object-cover"
                    />
                )}
                <AvatarFallback className="bg-foreground/10 text-xs font-medium">
                    {initialsOf(notification.actor.name)}
                </AvatarFallback>
            </Avatar>
            <span
                className={cn(
                    'absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2 ring-background',
                    tone.solid,
                )}
            >
                <Icon className="size-3" />
            </span>
        </span>
    );
}

export function NotificationSkeleton() {
    return (
        <div className="flex gap-3 px-4 py-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-16" />
            </div>
        </div>
    );
}
