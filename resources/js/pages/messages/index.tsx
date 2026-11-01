import { Head } from '@inertiajs/react';
import {
    ArrowLeft,
    MessagesSquare,
    PanelRight,
    Paperclip,
    SendHorizontal,
    SquarePen,
    X,
} from 'lucide-react';
import {
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { toast } from '@/lib/toast';
import { EmptyState } from '@/components/empty-state';
import {
    ContextPanel,
    ConversationRow,
    DayDivider,
    dayLabel,
    fileSize,
    firstName,
    kindLabels,
    MessageBubble,
    otherParty,
    PersonAvatar,
    statusLineText,
    StatusChip,
    SystemLine,
    TypingDots,
} from '@/components/messages/message-parts';
import { NewConversationDialog } from '@/components/messages/new-conversation-dialog';
import type { ConversationPreset } from '@/components/messages/new-conversation-dialog';
import {
    errorText,
    useConversationList,
    useMessagesSignals,
    useThread,
    useTypingPing,
} from '@/components/messages/use-messages';
import { SearchInput } from '@/components/search-input';
import { RisStatusBadge } from '@/components/status-badges';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { patchJson } from '@/lib/http';
import { cn } from '@/lib/utils';
import {
    index as messagesIndex,
    status as statusRoute,
} from '@/routes/messages';
import type {
    ConversationList,
    ConversationSummary,
    MessagePerson,
    MessagesOpening,
    MessagesTab,
    Thread,
    ThreadEvent,
    ThreadMessage,
} from '@/types';

type Props = {
    isOffice: boolean;
    list: ConversationList;
    people: MessagePerson[];
    opening: MessagesOpening;
    fileTypes: string[];
};

const MAX_FILES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** A gap this long starts a new group (name and time shown again). */
const GROUP_GAP_MS = 5 * 60_000;

/**
 * Messages: questions and updates about requests and concerns, between a
 * requester and the supply office. The office (the admin side) sees the
 * shared inbox; everyone else sees their own conversations. New messages
 * and typing arrive live (useInboxUpdates), or with the regular checks.
 */
export default function Messages({
    isOffice,
    list,
    people,
    opening,
    fileTypes,
}: Props) {
    const officeView = isOffice;
    const conversations = useConversationList(list);
    const { upsert, refreshRow, markSeen } = conversations;

    const [selectedId, setSelectedId] = useState<number | null>(
        opening && 'conversation' in opening ? opening.conversation : null,
    );
    const [threadOpen, setThreadOpen] = useState(
        Boolean(opening && 'conversation' in opening),
    );
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [preset, setPreset] = useState<ConversationPreset | null>(
        opening && 'ris' in opening ? opening : null,
    );
    const [starting, setStarting] = useState(Boolean(preset));

    const onSummary = useCallback(
        (row: ConversationSummary) => upsert({ ...row, unread: 0 }),
        [upsert],
    );
    const {
        thread,
        loading,
        loadingEarlier,
        loadEarlier,
        refresh,
        send,
        retry,
        setThread,
    } = useThread(selectedId, onSummary);

    // Live: refresh the open thread, or the row that changed.
    const typing = useMessagesSignals((signal) => {
        if (!signal) {
            conversations.reload();
            void refresh();

            return;
        }

        if (signal.conversation === selectedId) {
            void refresh().then(() => refreshRow(signal.conversation));
        } else {
            void refreshRow(signal.conversation);
        }
    });

    /** Send, then bring the row (status, tab counts) up to date. */
    const sendMessage = async (body: string, files: File[]) => {
        const target = selectedId;
        const sent = await send(body, files);

        if (sent && target !== null) {
            void refreshRow(target);
        }

        return sent;
    };

    // Wide screens show a thread beside the list: the newest, to start with.
    useEffect(() => {
        if (window.matchMedia('(min-width: 768px)').matches) {
            setSelectedId((current) => current ?? list.data[0]?.id ?? null);
        }
    }, [list]);

    const open = (conversation: ConversationSummary) => {
        setSelectedId(conversation.id);
        setThreadOpen(true);
        markSeen(conversation.id);
    };

    const started = (conversation: ConversationSummary) => {
        upsert(conversation);
        void refreshRow(conversation.id);
        setPreset(null);

        if (conversation.id === selectedId) {
            void refresh();
        } else {
            setSelectedId(conversation.id);
        }

        setThreadOpen(true);
    };

    const setResolved = async (resolved: boolean) => {
        if (!thread) {
            return;
        }

        try {
            const { conversation } = await patchJson<{
                conversation: ConversationSummary;
            }>(statusRoute.url(thread.conversation.id), { resolved });
            setThread((current) =>
                current ? { ...current, conversation } : current,
            );
            upsert(conversation);
            void refresh();
        } catch (error) {
            toast.error(
                errorText(error, 'That did not go through. Try again.'),
            );
        }
    };

    const selected =
        thread?.conversation ??
        conversations.rows.find((row) => row.id === selectedId) ??
        null;
    const tabs: { key: MessagesTab; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'request', label: 'Requests' },
        { key: 'concern', label: 'Concerns' },
        {
            key: 'waiting',
            label: officeView ? 'Needs reply' : 'Waiting',
        },
    ];

    return (
        <>
            <Head title="Messages" />
            <div className="flex h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)] md:p-4">
                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden border-y bg-card md:grid-cols-[18rem_minmax(0,1fr)] md:rounded-xl md:border lg:grid-cols-[23rem_minmax(0,1fr)] xl:grid-cols-[23rem_minmax(0,1fr)_19rem]">
                    {/* Conversations */}
                    <aside
                        className={cn(
                            'min-h-0 flex-col border-r',
                            threadOpen ? 'hidden md:flex' : 'flex',
                        )}
                    >
                        <div className="flex items-center justify-between gap-2 px-4 pt-4">
                            <h1 className="text-lg font-semibold tracking-tight">
                                Messages
                            </h1>
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
                                onClick={() => {
                                    setPreset(null);
                                    setStarting(true);
                                }}
                            >
                                <SquarePen className="size-4" />
                            </Button>
                        </div>
                        <div className="px-4 py-3">
                            <SearchInput
                                placeholder="Search messages"
                                aria-label="Search messages"
                                value={conversations.search}
                                onValueChange={conversations.setSearch}
                            />
                        </div>
                        <div
                            role="tablist"
                            aria-label="Show"
                            className="flex [scrollbar-width:none] gap-3 overflow-x-auto overflow-y-hidden border-b px-4"
                        >
                            {tabs.map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    role="tab"
                                    aria-selected={conversations.tab === key}
                                    onClick={() => conversations.setTab(key)}
                                    className={cn(
                                        '-mb-px shrink-0 border-b-2 pb-2 text-sm whitespace-nowrap transition-colors',
                                        conversations.tab === key
                                            ? 'border-primary font-medium text-foreground'
                                            : 'border-transparent text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {label}
                                    {conversations.counts[key] !==
                                        undefined && (
                                        <span className="ml-1 text-xs tabular-nums opacity-70">
                                            {conversations.counts[key]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        {conversations.rows.length === 0 ? (
                            conversations.loading ? (
                                <div className="flex flex-1 items-center justify-center">
                                    <Spinner />
                                </div>
                            ) : (
                                <EmptyState
                                    icon={MessagesSquare}
                                    title={
                                        conversations.search ||
                                        conversations.tab !== 'all'
                                            ? 'No conversations match'
                                            : 'No conversations yet'
                                    }
                                    description={
                                        conversations.search ||
                                        conversations.tab !== 'all'
                                            ? undefined
                                            : officeView
                                              ? 'Questions from requesters show up here.'
                                              : 'Ask the supply office about a request or a concern.'
                                    }
                                    className="flex-1"
                                />
                            )
                        ) : (
                            <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
                                {conversations.rows.map((conversation) => (
                                    <ConversationRow
                                        key={conversation.id}
                                        // The open conversation is read as it arrives.
                                        conversation={
                                            conversation.id === selectedId
                                                ? { ...conversation, unread: 0 }
                                                : conversation
                                        }
                                        selected={
                                            conversation.id === selectedId
                                        }
                                        officeView={officeView}
                                        typing={typing[conversation.id]}
                                        onSelect={() => open(conversation)}
                                    />
                                ))}
                                {conversations.hasMore && (
                                    <li className="p-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="w-full"
                                            disabled={conversations.loading}
                                            onClick={conversations.loadMore}
                                        >
                                            {conversations.loading && (
                                                <Spinner />
                                            )}
                                            Show more
                                        </Button>
                                    </li>
                                )}
                            </ul>
                        )}
                    </aside>

                    {/* Thread */}
                    <section
                        aria-label={selected?.subject ?? 'Conversation'}
                        className={cn(
                            'min-h-0 flex-col',
                            threadOpen ? 'flex' : 'hidden md:flex',
                        )}
                    >
                        {selected ? (
                            <>
                                <ThreadHeader
                                    conversation={selected}
                                    officeView={officeView}
                                    officeCount={thread?.office.length ?? 0}
                                    onBack={() => setThreadOpen(false)}
                                    onDetails={() => setDetailsOpen(true)}
                                    onResolve={setResolved}
                                />
                                <ThreadBody
                                    thread={
                                        thread?.conversation.id === selected.id
                                            ? thread
                                            : null
                                    }
                                    loading={loading}
                                    loadingEarlier={loadingEarlier}
                                    onLoadEarlier={loadEarlier}
                                    onRetry={retry}
                                    typing={typing[selected.id]}
                                />
                                <Composer
                                    key={selected.id}
                                    conversation={selected}
                                    officeView={officeView}
                                    fileTypes={fileTypes}
                                    disabled={!thread}
                                    onSend={sendMessage}
                                />
                            </>
                        ) : (
                            <EmptyState
                                icon={MessagesSquare}
                                title="Choose a conversation"
                                description="Or start a new one with the pencil button."
                                className="flex-1"
                            />
                        )}
                    </section>

                    {/* What it's about */}
                    <aside className="hidden min-h-0 overflow-y-auto border-l xl:block">
                        {thread && (
                            <ContextPanel
                                thread={thread}
                                officeView={officeView}
                            />
                        )}
                    </aside>
                </div>
            </div>

            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
                <SheetContent className="w-[min(22rem,100vw)] overflow-y-auto p-0 xl:hidden">
                    <SheetHeader className="border-b">
                        <SheetTitle>{selected?.subject}</SheetTitle>
                        <SheetDescription>
                            What this conversation is about, and who is in it
                        </SheetDescription>
                    </SheetHeader>
                    {thread && (
                        <ContextPanel thread={thread} officeView={officeView} />
                    )}
                </SheetContent>
            </Sheet>

            <NewConversationDialog
                open={starting}
                onOpenChange={setStarting}
                officeView={officeView}
                people={people}
                preset={preset}
                onStarted={started}
            />
        </>
    );
}

Messages.layout = {
    breadcrumbs: [{ title: 'Messages', href: messagesIndex() }],
};

function ThreadHeader({
    conversation,
    officeView,
    officeCount,
    onBack,
    onDetails,
    onResolve,
}: {
    conversation: ConversationSummary;
    officeView: boolean;
    officeCount: number;
    onBack: () => void;
    onDetails: () => void;
    onResolve: (resolved: boolean) => void;
}) {
    const other = otherParty(conversation, officeView);
    const asOffice = officeView && !conversation.mine;

    return (
        <header className="flex items-center gap-3 border-b px-3 py-3 sm:px-4">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 md:hidden"
                aria-label="Back to conversations"
                onClick={onBack}
            >
                <ArrowLeft />
            </Button>
            <PersonAvatar
                person={other}
                kind={conversation.kind}
                className="hidden sm:flex"
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium">
                        {asOffice ? other.name : conversation.subject}
                    </h2>
                    {conversation.ris ? (
                        <RisStatusBadge
                            slip={conversation.ris}
                            className="hidden sm:inline-flex"
                        />
                    ) : (
                        conversation.status !== 'open' && (
                            <StatusChip
                                status={conversation.status}
                                officeView={asOffice}
                            />
                        )
                    )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                    {asOffice
                        ? [
                              `${kindLabels[conversation.kind]}: ${conversation.subject}`,
                              conversation.requester?.division,
                          ]
                              .filter(Boolean)
                              .join(' · ')
                        : officeCount > 0
                          ? `Supply office · ${officeCount} ${officeCount === 1 ? 'person' : 'people'} can reply`
                          : 'Supply office'}
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onResolve(conversation.status !== 'resolved')}
            >
                {conversation.status === 'resolved'
                    ? 'Reopen'
                    : 'Mark resolved'}
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 xl:hidden"
                aria-label="Details"
                onClick={onDetails}
            >
                <PanelRight className="size-4" />
            </Button>
        </header>
    );
}

type Entry =
    | { type: 'message'; key: string; at: string; message: ThreadMessage }
    | { type: 'event'; key: string; at: string; event: ThreadEvent };

/**
 * The thread: a divider for each day, the request's own history and status
 * changes in the middle, and bubbles grouped while one person keeps writing.
 */
function ThreadBody({
    thread,
    loading,
    loadingEarlier,
    onLoadEarlier,
    onRetry,
    typing,
}: {
    thread: Thread | null;
    loading: boolean;
    loadingEarlier: boolean;
    onLoadEarlier: () => void;
    onRetry: (message: ThreadMessage) => void;
    typing?: string;
}) {
    const box = useRef<HTMLDivElement>(null);
    const pinned = useRef(true);
    const newestKey =
        thread?.messages.at(-1)?.local?.key ?? thread?.messages.at(-1)?.id;

    // Messages and the request's history, in time order. History older than
    // the first loaded message waits until earlier messages are loaded.
    const entries = useMemo<Entry[]>(() => {
        if (!thread) {
            return [];
        }

        const from = thread.has_earlier ? thread.messages[0]?.at : undefined;
        const events: Entry[] = thread.events
            .filter((event) => !from || event.at >= from)
            .map((event) => ({
                type: 'event',
                key: `e${event.id}`,
                at: event.at,
                event,
            }));
        const messages: Entry[] = thread.messages.map((message) => ({
            type: 'message',
            key: message.local?.key ?? `m${message.id}`,
            at: message.at,
            message,
        }));

        return [...events, ...messages].sort((a, b) =>
            a.at === b.at
                ? a.type === 'event'
                    ? -1
                    : 1
                : a.at.localeCompare(b.at),
        );
    }, [thread]);

    // Stay at the newest message when it grows, unless the reader scrolled up.
    useEffect(() => {
        if (pinned.current) {
            box.current?.scrollTo({ top: box.current.scrollHeight });
        }
    }, [newestKey, typing, thread?.conversation.id]);

    useEffect(() => {
        pinned.current = true;
    }, [thread?.conversation.id]);

    if (!thread) {
        return (
            <div className="flex flex-1 items-center justify-center">
                {loading && <Spinner />}
            </div>
        );
    }

    // Bubbles in a row from one person, close in time, share a name and time.
    const sameGroup = (a?: Entry, b?: Entry) =>
        a?.type === 'message' &&
        b?.type === 'message' &&
        a.message.side !== 'system' &&
        a.message.side === b.message.side &&
        a.message.author?.id === b.message.author?.id &&
        Math.abs(Date.parse(b.at) - Date.parse(a.at)) < GROUP_GAP_MS &&
        new Date(a.at).toDateString() === new Date(b.at).toDateString();

    return (
        <div
            ref={box}
            onScroll={(event) => {
                const el = event.currentTarget;
                pinned.current =
                    el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-4 sm:px-6"
        >
            {thread.has_earlier && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-center"
                    disabled={loadingEarlier}
                    onClick={onLoadEarlier}
                >
                    {loadingEarlier && <Spinner />}
                    Load earlier messages
                </Button>
            )}
            {entries.map((entry, index) => {
                const previous = entries[index - 1];
                const next = entries[index + 1];
                const newDay =
                    !previous ||
                    new Date(previous.at).toDateString() !==
                        new Date(entry.at).toDateString();

                return (
                    <Fragment key={entry.key}>
                        {newDay && <DayDivider label={dayLabel(entry.at)} />}
                        {entry.type === 'event' ? (
                            <SystemLine text={entry.event.body} at={entry.at} />
                        ) : entry.message.side === 'system' ? (
                            <SystemLine
                                text={statusLineText(entry.message)}
                                at={entry.at}
                            />
                        ) : (
                            <MessageBubble
                                message={entry.message}
                                showAuthor={
                                    newDay || !sameGroup(previous, entry)
                                }
                                showTime={!sameGroup(entry, next)}
                                onRetry={() => onRetry(entry.message)}
                            />
                        )}
                    </Fragment>
                );
            })}
            {typing && <TypingDots name={typing} />}
        </div>
    );
}

/** Writing a message: Enter sends, Shift+Enter starts a new line. */
function Composer({
    conversation,
    officeView,
    fileTypes,
    disabled,
    onSend,
}: {
    conversation: ConversationSummary;
    officeView: boolean;
    fileTypes: string[];
    disabled: boolean;
    onSend: (body: string, files: File[]) => Promise<boolean | undefined>;
}) {
    const [draft, setDraft] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const picker = useRef<HTMLInputElement>(null);
    const ping = useTypingPing(conversation.id);
    const asOffice = officeView && !conversation.mine;
    const otherName =
        asOffice && conversation.requester
            ? firstName(conversation.requester.name)
            : 'the supply office';
    const accept = fileTypes.map((type) => `.${type}`).join(',');

    const pick = (event: ChangeEvent<HTMLInputElement>) => {
        const chosen = Array.from(event.target.files ?? []);
        event.target.value = '';
        const tooBig = chosen.filter((file) => file.size > MAX_FILE_BYTES);
        const wrongType = chosen.filter(
            (file) =>
                !fileTypes.includes(
                    file.name.split('.').pop()?.toLowerCase() ?? '',
                ),
        );

        if (tooBig.length) {
            toast.error(`${tooBig[0].name} is over 10 MB.`);
        }

        if (wrongType.length) {
            toast.error(
                `${wrongType[0].name}: attach photos, PDFs or spreadsheets.`,
            );
        }

        const fine = chosen.filter(
            (file) => !tooBig.includes(file) && !wrongType.includes(file),
        );
        const next = [...files, ...fine];

        if (next.length > MAX_FILES) {
            toast.error(`Attach up to ${MAX_FILES} files at a time.`);
        }

        setFiles(next.slice(0, MAX_FILES));
    };

    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        const body = draft.trim();

        if ((!body && files.length === 0) || disabled) {
            return;
        }

        // Cleared at once; a failed send stays in the thread with "Try again".
        void onSend(body, files);
        setDraft('');
        setFiles([]);
    };

    return (
        <div className="border-t p-3 sm:px-4">
            {files.length > 0 && (
                <ul
                    className="mb-2 flex flex-wrap gap-2"
                    aria-label="Files to send"
                >
                    {files.map((file, index) => (
                        <li
                            key={`${file.name}-${index}`}
                            className="flex max-w-56 items-center gap-2 rounded-full border bg-muted/40 py-1 pr-1 pl-3 text-xs"
                        >
                            <span className="truncate">{file.name}</span>
                            <span className="shrink-0 text-muted-foreground">
                                {fileSize(file.size)}
                            </span>
                            <button
                                type="button"
                                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label={`Remove ${file.name}`}
                                onClick={() =>
                                    setFiles(
                                        files.filter((_, i) => i !== index),
                                    )
                                }
                            >
                                <X className="size-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <form
                onSubmit={submit}
                className="flex items-end gap-1 rounded-xl border bg-background p-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30"
            >
                <input
                    ref={picker}
                    type="file"
                    multiple
                    accept={accept}
                    className="hidden"
                    onChange={pick}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground"
                    aria-label="Attach photos, PDFs or spreadsheets"
                    title="Attach photos, PDFs or spreadsheets (up to 10 MB each)"
                    disabled={disabled || files.length >= MAX_FILES}
                    onClick={() => picker.current?.click()}
                >
                    <Paperclip className="size-4" />
                </Button>
                <textarea
                    rows={1}
                    value={draft}
                    maxLength={5000}
                    onChange={(event) => {
                        setDraft(event.target.value);

                        if (event.target.value.trim()) {
                            ping();
                        }
                    }}
                    onKeyDown={(event) => {
                        if (
                            event.key === 'Enter' &&
                            !event.shiftKey &&
                            !event.nativeEvent.isComposing
                        ) {
                            event.preventDefault();
                            submit();
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
                    disabled={disabled || (!draft.trim() && files.length === 0)}
                    aria-label="Send"
                >
                    <SendHorizontal className="size-4" />
                </Button>
            </form>
        </div>
    );
}
