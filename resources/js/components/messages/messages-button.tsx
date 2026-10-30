import { Link } from '@inertiajs/react';
import { MessageSquare } from 'lucide-react';
import { useMessagesSide } from '@/components/messages/message-parts';
import { sampleConversationsFor } from '@/components/messages/sample-conversations';
import { badgeLabel } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index as messagesIndex } from '@/routes/messages';

/** Header shortcut to Messages, beside the notification bell. */
export function MessagesButton() {
    // The preview's unread count (sample data until Messages is built).
    const unread = sampleConversationsFor(useMessagesSide()).reduce(
        (sum, conversation) => sum + conversation.unread,
        0,
    );
    const label = unread > 0 ? `Messages, ${unread} unread` : 'Messages';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    className="relative size-9"
                >
                    <Link href={messagesIndex()} aria-label={label}>
                        <MessageSquare className="size-5" />
                        {unread > 0 && (
                            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums">
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
