import { Head, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    MessagesSquare,
    PanelRight,
    Paperclip,
    SendHorizontal,
    SquarePen,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import {
    ContextPanel,
    ConversationRow,
    DayDivider,
    dayLabel,
    kindLabels,
    MessageBubble,
    otherParty,
    PersonAvatar,
    previewOnly,
    SystemEvent,
    TypingDots,
    useMessagesSide,
} from '@/components/messages/message-parts';
import { sampleConversationsFor } from '@/components/messages/sample-conversations';
import type { Person } from '@/components/messages/message-parts';
import type {
    SampleConversation,
    SampleMessage,
    Side,
} from '@/components/messages/sample-conversations';
import { SearchInput } from '@/components/search-input';
import { RisStatusBadge } from '@/components/status-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { index as messagesIndex } from '@/routes/messages';

type Tab = 'all' | SampleConversation['kind'];

const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'request', label: 'Requests' },
    { key: 'concern', label: 'Concerns' },
];

const QUICK_REPLIES = {
    office: [
        'Ready for pickup, 2 to 4 PM',
        'Noted, we will check',
        'Please confirm receipt',
    ],
    requester: ['Thank you!', 'On my way', 'Received, thanks'],
};

/** A gap this long starts a new group (name and time shown again). */
const GROUP_GAP_MS = 5 * 60_000;

/**
 * Messages, as a preview with sample data: questions and updates about
 * requests and concerns, between a requester and the supply office. Office
 * users (the admin side) see the shared inbox; staff see their own threads.
 * Nothing is sent or saved.
 */
export default function Messages() {
    const { auth } = usePage().props;
    const mySide = useMessagesSide();
    const officeView = mySide === 'office';

    const [conversations, setConversations] = useState<SampleConversation[]>(
        () =>
            officeView
                ? sampleConversationsFor(mySide)
                : // Staff see the sample as their own requests and concerns.
                  sampleConversationsFor(mySide).map((conversation) => ({
                      ...conversation,
                      requester: {
                          name: auth.user.name,
                          photo: auth.user.avatar ?? null,
                          division:
                              auth.user.department?.name ??
                              conversation.requester.division,
                      },
                  })),
    );
    const [selectedId, setSelectedId] = useState(conversations[0].id);
    const [tab, setTab] = useState<Tab>('all');
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState('');
    const [threadOpen, setThreadOpen] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const thread = useRef<HTMLDivElement>(null);

    const selected =
        conversations.find((conversation) => conversation.id === selectedId) ??
        conversations[0];

    const term = search.trim().toLowerCase();
    const visible = useMemo(
        () =>
            conversations.filter(
                (conversation) =>
                    (tab === 'all' || conversation.kind === tab) &&
                    (!term ||
                        `${conversation.title} ${conversation.requester.name} ${conversation.messages.map((m) => m.body ?? '').join(' ')}`
                            .toLowerCase()
                            .includes(term)),
            ),
        [conversations, tab, term],
    );

    const count = (key: Tab) =>
        key === 'all'
            ? conversations.length
            : conversations.filter((conversation) => conversation.kind === key)
                  .length;

    // The newest message is in view when a thread opens or grows.
    useEffect(() => {
        thread.current?.scrollTo({ top: thread.current.scrollHeight });
    }, [selectedId, selected.messages.length]);

    const update = (
        id: string,
        change: (conversation: SampleConversation) => SampleConversation,
    ) =>
        setConversations((current) =>
            current.map((conversation) =>
                conversation.id === id ? change(conversation) : conversation,
            ),
        );

    const open = (conversation: SampleConversation) => {
        setSelectedId(conversation.id);
        setThreadOpen(true);
        setDraft('');
        update(conversation.id, (c) => ({ ...c, unread: 0 }));
    };

    const send = (event?: FormEvent) => {
        event?.preventDefault();
        const body = draft.trim();

        if (!body) {
            return;
        }

        const message: SampleMessage = {
            id: `local-${Date.now()}`,
            side: mySide,
            ...(officeView
                ? { author: auth.user.name, role: 'Supply office' }
                : {}),
            at: new Date().toISOString(),
            body,
        };

        update(selected.id, (c) => ({
            ...c,
            typing: false,
            status: officeView ? 'open' : 'waiting',
            messages: [...c.messages, message],
        }));
        setDraft('');
    };

    const toggleResolved = () =>
        update(selected.id, (c) => ({
            ...c,
            status: c.status === 'resolved' ? 'open' : 'resolved',
            messages: [
                ...c.messages,
                {
                    id: `local-${Date.now()}`,
                    side: 'system',
                    at: new Date().toISOString(),
                    body: `${c.status === 'resolved' ? 'Reopened' : 'Marked resolved'} by ${auth.user.name}`,
                },
            ],
        }));

    const other = otherParty(selected, officeView);
    const otherName = officeView
        ? selected.requester.name.split(' ')[0]
        : 'the supply office';
    // Who is typing in the sample: the requester, or the officer on it.
    const typist: Person = officeView
        ? other
        : { name: 'Juan Dela Cruz', role: 'Supply Officer' };

    return (
        <>
            <Head title="Messages" />
            <div className="flex h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)] md:p-4">
                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden border-y bg-card md:grid-cols-[20rem_minmax(0,1fr)] md:rounded-xl md:border xl:grid-cols-[20rem_minmax(0,1fr)_19rem]">
                    {/* Conversations */}
                    <aside
                        className={cn(
                            'min-h-0 flex-col border-r',
                            threadOpen ? 'hidden md:flex' : 'flex',
                        )}
                    >
                        <div className="flex items-center justify-between gap-2 px-4 pt-4">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-semibold tracking-tight">
                                    Messages
                                </h1>
                                <Badge
                                    variant="outline"
                                    className="text-[11px] font-normal text-muted-foreground"
                                >
                                    Preview
                                </Badge>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={
                                    officeView
                                        ? 'New conversation'
                                        : 'Ask the supply office'
                                }
                                title={
                                    officeView
                                        ? 'New conversation'
                                        : 'Ask the supply office'
                                }
                                onClick={() =>
                                    previewOnly('starting a conversation')
                                }
                            >
                                <SquarePen className="size-4" />
                            </Button>
                        </div>
                        <div className="px-4 py-3">
                            <SearchInput
                                placeholder="Search messages"
                                aria-label="Search messages"
                                value={search}
                                onValueChange={setSearch}
                            />
                        </div>
                        <div
                            role="tablist"
                            aria-label="Show"
                            className="flex gap-4 border-b px-4"
                        >
                            {TABS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === key}
                                    onClick={() => setTab(key)}
                                    className={cn(
                                        '-mb-px border-b-2 pb-2 text-sm transition-colors',
                                        tab === key
                                            ? 'border-primary font-medium text-foreground'
                                            : 'border-transparent text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {label}
                                    <span className="ml-1 text-xs tabular-nums opacity-70">
                                        {count(key)}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {visible.length === 0 ? (
                            <EmptyState
                                icon={MessagesSquare}
                                title="No conversations match"
                                className="flex-1"
                            />
                        ) : (
                            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
                                {visible.map((conversation) => (
                                    <ConversationRow
                                        key={conversation.id}
                                        conversation={conversation}
                                        selected={
                                            conversation.id === selected.id
                                        }
                                        officeView={officeView}
                                        onSelect={() => open(conversation)}
                                    />
                                ))}
                            </ul>
                        )}
                        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                            Sample data. Nothing you send is saved.
                        </p>
                    </aside>

                    {/* Thread */}
                    <section
                        aria-label={selected.title}
                        className={cn(
                            'min-h-0 flex-col',
                            threadOpen ? 'flex' : 'hidden md:flex',
                        )}
                    >
                        <header className="flex items-center gap-3 border-b px-3 py-3 sm:px-4">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 md:hidden"
                                aria-label="Back to conversations"
                                onClick={() => setThreadOpen(false)}
                            >
                                <ArrowLeft />
                            </Button>
                            <PersonAvatar
                                person={other}
                                kind={selected.kind}
                                className="hidden sm:flex"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="truncate font-medium">
                                        {officeView
                                            ? selected.requester.name
                                            : selected.title}
                                    </h2>
                                    {selected.ris && (
                                        <RisStatusBadge
                                            slip={selected.ris}
                                            className="hidden sm:inline-flex"
                                        />
                                    )}
                                </div>
                                <p className="truncate text-xs text-muted-foreground">
                                    {officeView
                                        ? `${kindLabels[selected.kind]}: ${selected.title} · ${selected.requester.division}`
                                        : 'Supply office · 3 people can reply'}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={toggleResolved}
                            >
                                {selected.status === 'resolved'
                                    ? 'Reopen'
                                    : 'Mark resolved'}
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 xl:hidden"
                                aria-label="Details"
                                onClick={() => setDetailsOpen(true)}
                            >
                                <PanelRight className="size-4" />
                            </Button>
                        </header>

                        <div
                            ref={thread}
                            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-6"
                        >
                            <ThreadMessages
                                conversation={selected}
                                mySide={mySide}
                            />
                            {selected.typing && <TypingDots person={typist} />}
                        </div>

                        <div className="border-t p-3 sm:px-4">
                            <div className="mb-2 flex gap-2 overflow-x-auto">
                                {QUICK_REPLIES[
                                    mySide === 'office' ? 'office' : 'requester'
                                ].map((reply) => (
                                    <button
                                        key={reply}
                                        type="button"
                                        onClick={() => setDraft(reply)}
                                        className="shrink-0 rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>
                            <form
                                onSubmit={send}
                                className="flex items-end gap-1 rounded-xl border bg-background p-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
                            >
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-9 text-muted-foreground"
                                    aria-label="Attach a file"
                                    onClick={() =>
                                        previewOnly('attaching files')
                                    }
                                >
                                    <Paperclip className="size-4" />
                                </Button>
                                <textarea
                                    rows={1}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            send();
                                        }
                                    }}
                                    placeholder={`Message ${otherName}…`}
                                    aria-label="Message"
                                    className="[field-sizing:content] max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    className="size-9"
                                    disabled={!draft.trim()}
                                    aria-label="Send"
                                >
                                    <SendHorizontal className="size-4" />
                                </Button>
                            </form>
                        </div>
                    </section>

                    {/* What it's about */}
                    <aside className="hidden min-h-0 overflow-y-auto border-l xl:block">
                        <ContextPanel
                            conversation={selected}
                            officeView={officeView}
                        />
                    </aside>
                </div>
            </div>

            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
                <SheetContent className="w-[min(22rem,100vw)] overflow-y-auto p-0 xl:hidden">
                    <SheetHeader className="border-b">
                        <SheetTitle>{selected.title}</SheetTitle>
                        <SheetDescription>
                            {selected.kind === 'request'
                                ? 'The request this conversation is about'
                                : 'The concern this conversation is about'}
                        </SheetDescription>
                    </SheetHeader>
                    <ContextPanel
                        conversation={selected}
                        officeView={officeView}
                    />
                </SheetContent>
            </Sheet>
        </>
    );
}

Messages.layout = {
    breadcrumbs: [{ title: 'Messages', href: messagesIndex() }],
};

/**
 * The thread: a divider for each day, the request's own events in the
 * middle, and bubbles grouped while the same person keeps writing.
 */
function ThreadMessages({
    conversation,
    mySide,
}: {
    conversation: SampleConversation;
    mySide: Side;
}) {
    const { messages, requester } = conversation;
    const authorOf = (message: SampleMessage): Person =>
        message.side === 'requester'
            ? { ...requester, role: 'Requester' }
            : { name: message.author ?? 'Supply office', role: message.role };

    return messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const newDay =
            !previous ||
            new Date(previous.at).toDateString() !==
                new Date(message.at).toDateString();
        const sameGroup = (a?: SampleMessage, b?: SampleMessage) =>
            !!a &&
            !!b &&
            a.side === b.side &&
            a.author === b.author &&
            Math.abs(Date.parse(b.at) - Date.parse(a.at)) < GROUP_GAP_MS &&
            new Date(a.at).toDateString() === new Date(b.at).toDateString();

        return (
            <Fragment key={message.id}>
                {newDay && <DayDivider label={dayLabel(message.at)} />}
                {message.side === 'system' ? (
                    <SystemEvent message={message} />
                ) : (
                    <MessageBubble
                        message={message}
                        author={authorOf(message)}
                        mine={message.side === mySide}
                        showAuthor={newDay || !sameGroup(previous, message)}
                        showTime={!sameGroup(message, next)}
                    />
                )}
            </Fragment>
        );
    });
}
