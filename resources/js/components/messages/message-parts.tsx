import { Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    Building2,
    CircleAlert,
    ClipboardList,
    Download,
    FileSpreadsheet,
    FileText,
    Info,
    MessageCircle,
    RotateCw,
} from 'lucide-react';
import { useState } from 'react';
import { badgeTone, RisStatusBadge } from '@/components/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatDate, formatTime, initialsOf } from '@/lib/format';
import { risKey } from '@/lib/ris';
import { cn } from '@/lib/utils';
import { show as showRis } from '@/routes/ris';
import type {
    ConversationKind,
    ConversationStatus,
    ConversationSummary,
    MessageFile,
    MessagePerson,
    Thread,
    ThreadMessage,
} from '@/types';

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

/** "2.4 MB", "830 KB". */
export function fileSize(bytes: number): string {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const firstName = (name: string) => name.split(' ')[0];

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

    return (
        <Badge
            variant="outline"
            className={cn(
                'px-1.5 py-0 text-[11px] font-medium',
                statusTone[status],
            )}
        >
            {label}
        </Badge>
    );
}

export const kindIcons = {
    request: ClipboardList,
    concern: CircleAlert,
    general: MessageCircle,
};

export const kindLabels: Record<ConversationKind, string> = {
    request: 'Request',
    concern: 'Concern',
    general: 'Other',
};

/** Who a message or conversation is with. */
export type Person = {
    name: string;
    role?: string | null;
    photo?: string | null;
    /** The supply office as a whole (no one has replied yet). */
    office?: boolean;
};

export const SUPPLY_OFFICE: Person = { name: 'Supply office', office: true };

/**
 * A person's photo (or initials), or the supply office's mark. The corner
 * badge says what the conversation is about.
 */
export function PersonAvatar({
    person,
    kind,
    size = 'md',
    className,
}: {
    person: Person;
    kind?: ConversationKind;
    size?: 'sm' | 'md';
    className?: string;
}) {
    const KindIcon = kind ? kindIcons[kind] : null;
    // A photo whose file is missing shows initials instead of a broken image.
    const [broken, setBroken] = useState<string | null>(null);
    const photo = person.photo && person.photo !== broken ? person.photo : null;

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
                {photo ? (
                    <img
                        src={photo}
                        alt=""
                        onError={() => setBroken(photo)}
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
                            : kind === 'concern'
                              ? 'bg-amber-500 text-white'
                              : 'bg-muted-foreground text-background',
                    )}
                >
                    <KindIcon className="size-2.5" />
                </span>
            )}
        </span>
    );
}

/**
 * The other side of a conversation, as the viewer sees it: the requester
 * for the office; for a requester, the officer who replied last (or the
 * office as a whole).
 */
export function otherParty(
    conversation: ConversationSummary,
    officeView: boolean,
): Person {
    if (officeView && !conversation.mine) {
        return conversation.requester ?? { name: 'Former user' };
    }

    return conversation.replied_by ?? SUPPLY_OFFICE;
}

/** The newest message, as one line ("You: …", "Juan: …"). */
function lastLine(conversation: ConversationSummary): string {
    const { last } = conversation;

    if (!last) {
        return '';
    }

    if (last.side === 'system') {
        return `${last.author ? firstName(last.author.name) : 'Someone'} ${last.body === 'resolved' ? 'marked it resolved' : 'reopened it'}`;
    }

    const mineSide = conversation.mine ? 'requester' : 'office';
    const who =
        last.side === mineSide
            ? 'You: '
            : last.author
              ? `${firstName(last.author.name)}: `
              : '';
    const text =
        last.body ??
        (last.files === 1 ? 'Sent a file' : `Sent ${last.files} files`);

    return who + text;
}

export function ConversationRow({
    conversation,
    selected,
    officeView,
    typing,
    onSelect,
}: {
    conversation: ConversationSummary;
    selected: boolean;
    officeView: boolean;
    /** First name of whoever is typing in it right now. */
    typing?: string | null;
    onSelect: () => void;
}) {
    const person = otherParty(conversation, officeView);
    const KindIcon = kindIcons[conversation.kind];
    const unread = conversation.unread > 0;

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
                                unread ? 'font-semibold' : 'font-medium',
                            )}
                        >
                            {person.name}
                        </span>
                        {conversation.updated_at && (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {listTime(conversation.updated_at)}
                            </span>
                        )}
                    </span>
                    {/* What the conversation is about. */}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <KindIcon className="size-3 shrink-0" />
                        <span className="sr-only">
                            {kindLabels[conversation.kind]}:
                        </span>
                        <span className="truncate font-medium text-foreground/80">
                            {conversation.subject}
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
                                typing
                                    ? 'text-primary'
                                    : unread
                                      ? 'text-foreground'
                                      : 'text-muted-foreground',
                            )}
                        >
                            {typing
                                ? `${typing} is typing…`
                                : lastLine(conversation)}
                        </span>
                        {unread && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                                {conversation.unread}
                                <span className="sr-only"> unread</span>
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

/** Something that happened: the request moved on, or the status changed. */
export function SystemLine({ text, at }: { text: string; at: string }) {
    return (
        <p className="mx-auto flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0" />
            <span className="truncate">{text}</span>
            <span className="shrink-0 tabular-nums">· {formatTime(at)}</span>
        </p>
    );
}

/** A status line's text: "Maria marked it resolved". */
export function statusLineText(message: ThreadMessage): string {
    const who = message.mine
        ? 'You'
        : message.author
          ? firstName(message.author.name)
          : 'Someone';

    return message.body === 'resolved'
        ? `${who} marked this resolved`
        : `${who} reopened this`;
}

/** Who wrote a message, with what they do. */
export function authorOf(message: ThreadMessage): Person {
    const fallback = message.side === 'office' ? 'Supply office' : 'Requester';

    return message.author
        ? {
              name: message.author.name,
              photo: message.author.photo,
              role:
                  message.side === 'office'
                      ? (message.author.role ?? 'Supply office')
                      : 'Requester',
          }
        : { name: 'Former user', role: fallback };
}

export function MessageBubble({
    message,
    showAuthor,
    showTime,
    onRetry,
}: {
    message: ThreadMessage;
    showAuthor: boolean;
    showTime: boolean;
    onRetry?: () => void;
}) {
    const { mine, local } = message;
    const author = authorOf(message);

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
                    local && !local.failed && 'opacity-70',
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
                            'rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-line',
                            mine
                                ? 'rounded-br-md bg-primary text-primary-foreground'
                                : 'rounded-bl-md bg-muted',
                        )}
                    >
                        {message.body}
                    </p>
                )}
                {message.attachments.map((file) => (
                    <AttachmentCard key={file.id} file={file} />
                ))}
                {local?.files.map((file) => (
                    <PendingFile key={file.name} file={file} />
                ))}
                {local?.failed ? (
                    <span className="flex items-center gap-1 px-1 text-[11px] text-destructive">
                        Not sent.
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                            >
                                <RotateCw className="size-3" />
                                Try again
                            </button>
                        )}
                    </span>
                ) : local ? (
                    <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                        <Spinner className="size-3" />
                        Sending…
                    </span>
                ) : (
                    showTime && (
                        <span className="px-1 text-[11px] text-muted-foreground tabular-nums">
                            {formatTime(message.at)}
                        </span>
                    )
                )}
            </div>
        </div>
    );
}

const isImage = (mime: string) => mime.startsWith('image/');

/** A sent file: photos show as a picture, others as a card to download. */
export function AttachmentCard({ file }: { file: MessageFile }) {
    if (isImage(file.mime)) {
        return (
            <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border bg-muted"
                title={file.name}
            >
                <img
                    src={file.url}
                    alt={file.name}
                    loading="lazy"
                    className="max-h-64 w-auto max-w-full object-contain"
                />
            </a>
        );
    }

    const Icon = file.mime === 'application/pdf' ? FileText : FileSpreadsheet;

    return (
        <div className="flex w-64 max-w-full items-center gap-3 rounded-xl border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                    {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                    {fileSize(file.size)}
                </span>
            </span>
            <Button asChild variant="ghost" size="icon" className="size-8">
                <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${file.name}`}
                >
                    <Download className="size-4" />
                </a>
            </Button>
        </div>
    );
}

/** A file still on its way up. */
function PendingFile({ file }: { file: File }) {
    return (
        <div className="flex w-64 max-w-full items-center gap-3 rounded-xl border bg-card p-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                    {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                    {fileSize(file.size)}
                </span>
            </span>
        </div>
    );
}

export function TypingDots({ name }: { name: string }) {
    return (
        <div
            className="flex items-center gap-2 self-start"
            role="status"
            aria-live="polite"
        >
            <PersonAvatar person={{ name }} size="sm" />
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
                {name} is typing…
            </span>
        </div>
    );
}

/** What the conversation is about, and who is in it. */
export function ContextPanel({
    thread,
    officeView,
}: {
    thread: Thread;
    officeView: boolean;
}) {
    const { context, conversation, office } = thread;
    const { ris, property } = context;
    const requester = conversation.requester;

    return (
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6 p-5 text-sm">
            {ris && (
                <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium">{ris.no}</h3>
                        <RisStatusBadge slip={ris} />
                    </div>
                    <dl className="grid grid-cols-[minmax(0,1fr)] gap-1 text-xs">
                        {ris.requested_at && (
                            <Fact
                                label="Requested"
                                value={`${formatDate(ris.requested_at)}, ${formatTime(ris.requested_at)}`}
                            />
                        )}
                        {ris.division && (
                            <Fact label="Division" value={ris.division} />
                        )}
                        {ris.purpose && (
                            <Fact label="Purpose" value={ris.purpose} />
                        )}
                    </dl>
                    {ris.items.length > 0 && (
                        <ul className="divide-y rounded-lg border">
                            {ris.items.map((item, index) => (
                                <li
                                    key={index}
                                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                                >
                                    <span className="truncate">
                                        {item.name}
                                    </span>
                                    <span className="shrink-0 text-muted-foreground tabular-nums">
                                        {item.quantity} {item.unit}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Button asChild variant="outline" size="sm">
                        <Link href={showRis(risKey({ route_key: ris.key }))}>
                            Open RIS
                            <ArrowUpRight />
                        </Link>
                    </Button>
                </section>
            )}

            {property && (
                <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
                    <h3 className="font-medium">Property</h3>
                    <dl className="grid grid-cols-[minmax(0,1fr)] gap-1 text-xs">
                        <Fact label="Item" value={property.name} />
                        <Fact label="Property no." value={property.number} />
                        {property.condition && (
                            <Fact
                                label="Condition"
                                value={property.condition}
                            />
                        )}
                        {property.location && (
                            <Fact
                                label="Property location"
                                value={property.location}
                            />
                        )}
                    </dl>
                </section>
            )}

            <section className="grid grid-cols-[minmax(0,1fr)] gap-3">
                <h3 className="font-medium">People</h3>
                <ul className="grid gap-2.5">
                    {requester && (
                        <PersonLine
                            person={requester}
                            detail={
                                conversation.mine
                                    ? 'You'
                                    : (requester.division ?? 'Requester')
                            }
                        />
                    )}
                    {office
                        .filter((person) => person.id !== requester?.id)
                        .map((person) => (
                            <PersonLine
                                key={person.id}
                                person={person}
                                detail={
                                    person.role
                                        ? `${person.role} · Supply office`
                                        : 'Supply office'
                                }
                            />
                        ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                    {officeView
                        ? 'Everyone in the supply office sees this conversation and can reply.'
                        : 'Anyone in the supply office can reply, so nothing waits on one person.'}
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

function PersonLine({
    person,
    detail,
}: {
    person: MessagePerson;
    detail: string;
}) {
    return (
        <li className="flex items-center gap-2.5">
            <PersonAvatar person={person} size="sm" className="size-8" />
            <span className="min-w-0">
                <span className="block truncate text-sm">{person.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                    {detail}
                </span>
            </span>
        </li>
    );
}
