import { usePage } from '@inertiajs/react';
import {
    ArrowUpRight,
    Building2,
    CircleAlert,
    ClipboardList,
    Download,
    FileSpreadsheet,
    FileText,
    ImageIcon,
    Info,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
    Attachment,
    ConversationStatus,
    SampleConversation,
    SampleMessage,
    Side,
} from '@/components/messages/sample-conversations';
import { OFFICE_PEOPLE } from '@/components/messages/sample-conversations';
import { badgeTone, RisStatusBadge } from '@/components/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCan } from '@/hooks/use-can';
import { formatDate, formatTime, initialsOf } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Whose side the viewer is on: the admin side answers for the supply office
 * (the shared inbox); everyone else (and admins in user mode) is a requester.
 */
export function useMessagesSide(): Side {
    const { auth } = usePage().props;
    const can = useCan();

    return can('dashboard.view') && !auth.isAdminUserMode
        ? 'office'
        : 'requester';
}

/** Everything in the preview that would do something says so. */
export const previewOnly = (what: string) =>
    toast(`Preview only: ${what} works once Messages is built.`);

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "09:41 AM" today, "Mon" this week, "Oct 22" before that. */
export function listTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();

    if (sameDay(date, now)) {
        return formatTime(iso);
    }

    const days = (now.getTime() - date.getTime()) / 86_400_000;

    return days < 6
        ? date.toLocaleDateString('en', { weekday: 'short' })
        : date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/** "Today", "Yesterday" or "Oct 26, 2026", for the dividers in a thread. */
export function dayLabel(iso: string): string {
    const date = new Date(iso);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (sameDay(date, new Date())) {
        return 'Today';
    }

    return sameDay(date, yesterday) ? 'Yesterday' : formatDate(iso);
}

const statusTone: Record<ConversationStatus, string> = {
    open: badgeTone.blue,
    waiting: badgeTone.amber,
    resolved: badgeTone.gray,
};

/** "Waiting" means the office owes a reply, said from each side. */
export function StatusChip({
    status,
    officeView,
}: {
    status: ConversationStatus;
    officeView: boolean;
}) {
    const label = {
        open: 'Open',
        waiting: officeView ? 'Needs reply' : 'Awaiting reply',
        resolved: 'Resolved',
    }[status];
    const tone = statusTone[status];

    return (
        <Badge
            variant="outline"
            className={cn('px-1.5 py-0 text-[11px] font-medium', tone)}
        >
            {label}
        </Badge>
    );
}

const kindIcons = { request: ClipboardList, concern: CircleAlert };

export const kindLabels = { request: 'Request', concern: 'Concern' };

/** Who a message or conversation is with. */
export type Person = {
    name: string;
    role?: string;
    photo?: string | null;
    /** The supply office as a whole (no one has replied yet). */
    office?: boolean;
};

/**
 * A person's photo (or initials), or the supply office's mark. The corner
 * badge says what the conversation is about: a request or a concern.
 */
export function PersonAvatar({
    person,
    kind,
    size = 'md',
    className,
}: {
    person: Person;
    kind?: SampleConversation['kind'];
    size?: 'sm' | 'md';
    className?: string;
}) {
    const KindIcon = kind ? kindIcons[kind] : null;

    return (
        <span
            aria-hidden
            className={cn(
                'relative flex shrink-0',
                size === 'md' ? 'size-10' : 'size-7',
                className,
            )}
        >
            <span
                className={cn(
                    'flex size-full items-center justify-center overflow-hidden rounded-full font-medium',
                    size === 'md' ? 'text-sm' : 'text-[10px]',
                    person.office
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-foreground',
                )}
            >
                {person.photo ? (
                    <img
                        src={person.photo}
                        alt=""
                        className="size-full object-cover"
                    />
                ) : person.office ? (
                    <Building2
                        className={size === 'md' ? 'size-5' : 'size-3.5'}
                    />
                ) : (
                    initialsOf(person.name)
                )}
            </span>
            {KindIcon && (
                <span
                    className={cn(
                        'absolute -right-0.5 -bottom-0.5 flex size-[18px] items-center justify-center rounded-full ring-2 ring-card',
                        kind === 'request'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-amber-500 text-white',
                    )}
                >
                    <KindIcon className="size-2.5" />
                </span>
            )}
        </span>
    );
}

/** The other side of a conversation, as the viewer sees it. */
export function otherParty(
    conversation: SampleConversation,
    officeView: boolean,
): Person {
    if (officeView) {
        return { ...conversation.requester, role: 'Requester' };
    }

    // Staff talk to the office: the last officer who replied, if anyone has.
    const reply = conversation.messages.findLast(
        (message) => message.side === 'office' && message.author,
    );

    return reply
        ? { name: reply.author!, role: reply.role }
        : { name: 'Supply office', office: true };
}

export function ConversationRow({
    conversation,
    selected,
    officeView,
    onSelect,
}: {
    conversation: SampleConversation;
    selected: boolean;
    officeView: boolean;
    onSelect: () => void;
}) {
    const last = conversation.messages.at(-1)!;
    const who =
        last.side === 'system'
            ? ''
            : last.side === (officeView ? 'office' : 'requester')
              ? 'You: '
              : `${(officeView ? conversation.requester.name : (last.author ?? 'Supply office')).split(' ')[0]}: `;
    const preview = last.body ?? `Sent ${last.attachment?.name}`;
    const person = otherParty(conversation, officeView);
    const KindIcon = kindIcons[conversation.kind];

    return (
        <li>
            <button
                type="button"
                onClick={onSelect}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                    'flex w-full gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    selected ? 'bg-accent' : 'hover:bg-muted/60',
                )}
            >
                <PersonAvatar person={person} kind={conversation.kind} />
                <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                        <span
                            className={cn(
                                'truncate text-sm',
                                conversation.unread > 0
                                    ? 'font-semibold'
                                    : 'font-medium',
                            )}
                        >
                            {person.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {listTime(last.at)}
                        </span>
                    </span>
                    {/* What the conversation is about. */}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <KindIcon className="size-3 shrink-0" />
                        <span className="sr-only">
                            {kindLabels[conversation.kind]}:
                        </span>
                        <span className="truncate font-medium text-foreground/80">
                            {conversation.title}
                        </span>
                        {conversation.status !== 'open' && (
                            <StatusChip
                                status={conversation.status}
                                officeView={officeView}
                            />
                        )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                        <span
                            className={cn(
                                'min-w-0 flex-1 truncate text-xs',
                                conversation.unread > 0
                                    ? 'text-foreground'
                                    : 'text-muted-foreground',
                            )}
                        >
                            {who}
                            {preview}
                        </span>
                        {conversation.unread > 0 && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                                {conversation.unread}
                            </span>
                        )}
                    </span>
                </span>
            </button>
        </li>
    );
}

export function DayDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {label}
            <span className="h-px flex-1 bg-border" />
        </div>
    );
}

/** Something that happened to the request (submitted, approved, issued…). */
export function SystemEvent({ message }: { message: SampleMessage }) {
    return (
        <p className="mx-auto flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" />
            <span className="truncate">{message.body}</span>
            <span className="shrink-0 tabular-nums">
                · {formatTime(message.at)}
            </span>
        </p>
    );
}

export function MessageBubble({
    message,
    author,
    mine,
    showAuthor,
    showTime,
}: {
    message: SampleMessage;
    author: Person;
    mine: boolean;
    showAuthor: boolean;
    showTime: boolean;
}) {
    return (
        <div
            className={cn(
                'flex max-w-[min(36rem,88%)] gap-2',
                mine ? 'self-end' : 'self-start',
            )}
        >
            {!mine && (
                <span className="w-7 shrink-0">
                    {showAuthor && <PersonAvatar person={author} size="sm" />}
                </span>
            )}
            <div
                className={cn(
                    'flex min-w-0 flex-col gap-1',
                    mine ? 'items-end' : 'items-start',
                )}
            >
                {showAuthor && !mine && (
                    <span className="px-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                            {author.name}
                        </span>
                        {author.role && ` · ${author.role}`}
                    </span>
                )}
                {message.body && (
                    <p
                        className={cn(
                            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-line',
                            mine
                                ? 'rounded-br-md bg-primary text-primary-foreground'
                                : 'rounded-bl-md bg-muted',
                        )}
                    >
                        {message.body}
                    </p>
                )}
                {message.attachment && (
                    <AttachmentCard attachment={message.attachment} />
                )}
                {showTime && (
                    <span className="px-1 text-[11px] text-muted-foreground tabular-nums">
                        {formatTime(message.at)}
                    </span>
                )}
            </div>
        </div>
    );
}

const attachmentIcons = {
    sheet: FileSpreadsheet,
    pdf: FileText,
    image: ImageIcon,
};

export function AttachmentCard({ attachment }: { attachment: Attachment }) {
    const Icon = attachmentIcons[attachment.kind];

    return (
        <div className="w-64 max-w-full overflow-hidden rounded-xl border bg-card">
            {attachment.kind === 'image' && (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground">
                    <ImageIcon className="size-8" />
                </div>
            )}
            <div className="flex items-center gap-3 p-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                        {attachment.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {attachment.size}
                    </span>
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Download ${attachment.name}`}
                    onClick={() => previewOnly('downloading')}
                >
                    <Download className="size-4" />
                </Button>
            </div>
        </div>
    );
}

export function TypingDots({ person }: { person: Person }) {
    return (
        <div className="flex items-center gap-2 self-start">
            <PersonAvatar person={person} size="sm" />
            <span
                className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3"
                aria-hidden
            >
                {[0, 150, 300].map((delay) => (
                    <span
                        key={delay}
                        className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                    />
                ))}
            </span>
            <span className="text-xs text-muted-foreground">
                {person.name.split(' ')[0]} is typing…
            </span>
        </div>
    );
}

/** What the conversation is about: the request, or the concern's details. */
export function ContextPanel({
    conversation,
    officeView,
}: {
    conversation: SampleConversation;
    officeView: boolean;
}) {
    const { ris, concern, requester } = conversation;

    return (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6 p-5 text-sm">
            {ris && (
                <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium">{ris.no}</h3>
                        <RisStatusBadge slip={ris} />
                    </div>
                    <dl className="grid grid-cols-[minmax(0,1fr)] gap-1 text-xs">
                        <Fact
                            label="Requested"
                            value={`${formatDate(ris.requested_at)}, ${formatTime(ris.requested_at)}`}
                        />
                        <Fact label="Division" value={requester.division} />
                    </dl>
                    <ul className="divide-y rounded-lg border">
                        {ris.items.map((item) => (
                            <li
                                key={item.name}
                                className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                            >
                                <span className="truncate">{item.name}</span>
                                <span className="shrink-0 text-muted-foreground tabular-nums">
                                    {item.quantity} {item.unit}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => previewOnly('opening the RIS')}
                    >
                        Open RIS
                        <ArrowUpRight />
                    </Button>
                </section>
            )}

            {concern && (
                <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    <h3 className="font-medium">Concern</h3>
                    <dl className="grid grid-cols-[minmax(0,1fr)] gap-1 text-xs">
                        <Fact label="Category" value={concern.category} />
                        <Fact label="About" value={concern.property} />
                        <Fact label="Reference" value={concern.property_no} />
                        <Fact label="Location" value={concern.location} />
                    </dl>
                </section>
            )}

            <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
                <h3 className="font-medium">People</h3>
                <ul className="grid gap-2.5">
                    <Person
                        name={requester.name}
                        detail={officeView ? 'Requester' : 'You'}
                    />
                    {OFFICE_PEOPLE.map((person) => (
                        <Person
                            key={person.name}
                            name={person.name}
                            detail={`${person.role} · Supply office`}
                        />
                    ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                    Anyone in the supply office can reply, so nothing waits on
                    one person.
                </p>
            </section>
        </div>
    );
}

function Fact({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-right" title={value}>
                {value}
            </dd>
        </div>
    );
}

function Person({ name, detail }: { name: string; detail: string }) {
    return (
        <li className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium">
                {initialsOf(name)}
            </span>
            <span className="min-w-0">
                <span className="block truncate text-sm">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                    {detail}
                </span>
            </span>
        </li>
    );
}
