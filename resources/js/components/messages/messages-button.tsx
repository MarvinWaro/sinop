import { Link, usePage } from '@inertiajs/react';
import { MessageSquare } from 'lucide-react';
import { badgeLabel } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index as messagesIndex } from '@/routes/messages';

/**
 * Header shortcut to Messages, beside the notification bell, with the
 * number of unread messages (kept current by useInboxUpdates).
 */
export function MessagesButton() {
    const unread = usePage().props.messagesUnread ?? 0;
    const label = unread > 0 ? `Messages, ${unread} unread` : 'Messages';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="relative size-8 text-muted-foreground hover:text-foreground"
                >
                    <Link href={messagesIndex()} aria-label={label}>
                        <MessageSquare className="size-4" />
                        {unread > 0 && (
                            <span className="absolute top-0.5 right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-alert px-1 text-[9px] leading-none font-semibold text-white tabular-nums shadow-alert ring-2 ring-background">
                                {badgeLabel(unread)}
                            </span>
                        )}
                    </Link>
                </Button>
            </TooltipTrigger>
            <TooltipContent>Messages</TooltipContent>
        </Tooltip>
    );
}
