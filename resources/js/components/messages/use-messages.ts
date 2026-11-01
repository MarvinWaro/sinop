import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import { MESSAGES_EVENT, TYPING_EVENT } from '@/hooks/use-inbox';
import { getJson, HttpError, postForm, postJson } from '@/lib/http';
import {
    conversations as conversationsRoute,
    read as readRoute,
    send as sendRoute,
    show as showRoute,
    typing as typingRoute,
} from '@/routes/messages';
import type {
    ConversationList,
    ConversationSummary,
    MessagesSignal,
    MessagesTab,
    Thread,
    ThreadMessage,
    TypingSignal,
} from '@/types';

/** How long typing dots stay up after the last signal. */
const TYPING_SHOWN_MS = 4_000;
/** Tell the others "typing" at most this often (the server throttles too). */
const TYPING_EVERY_MS = 3_000;

/** The message a failed request should show. */
export function errorText(error: unknown, fallback: string): string {
    if (
        error instanceof HttpError &&
        error.data &&
        typeof error.data === 'object'
    ) {
        const errors = (error.data as { errors?: Record<string, string[]> })
            .errors;
        const first = errors ? Object.values(errors)[0]?.[0] : undefined;

        return first ?? error.message;
    }

    return fallback;
}

/** Newest activity first. */
const byNewest = (a: ConversationSummary, b: ConversationSummary) =>
    (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || b.id - a.id;

function onWindow<T>(name: string, listener: (detail: T) => void): () => void {
    const handler = (event: Event) =>
        listener((event as CustomEvent<T>).detail);
    window.addEventListener(name, handler);

    return () => window.removeEventListener(name, handler);
}

/**
 * The list of conversations: a tab and a search, more pages on demand,
 * and rows refreshed one at a time as live signals arrive.
 */
export function useConversationList(initial: ConversationList) {
    const [rows, setRows] = useState(initial.data);
    const [nextPage, setNextPage] = useState(initial.next_page);
    const [counts, setCounts] = useState(initial.counts);
    const [tab, setTab] = useState<MessagesTab>('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const query = useRef({ tab, search });
    query.current = { tab, search };
    const firstRun = useRef(true);

    const load = useCallback(async (page = 1) => {
        setLoading(true);

        try {
            const result = await getJson<ConversationList>(
                conversationsRoute.url(),
                { ...query.current, page },
            );

            setRows((current) =>
                page === 1 ? result.data : [...current, ...result.data],
            );
            setNextPage(result.next_page);
            setCounts(result.counts);
        } catch {
            toast.error('Messages could not be loaded. Try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // A new tab loads at once; typing in the search waits for a pause.
    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;

            return;
        }

        const timer = window.setTimeout(() => void load(), search ? 300 : 0);

        return () => window.clearTimeout(timer);
    }, [tab, search, load]);

    /** Put this row in (or take it out) without reloading the list. */
    const upsert = useCallback((row: ConversationSummary) => {
        setRows((current) =>
            [...current.filter((item) => item.id !== row.id), row].sort(
                byNewest,
            ),
        );
    }, []);

    /** Fetch one row again (and the tab counts), e.g. after a signal. */
    const refreshRow = useCallback(
        async (id: number) => {
            try {
                const result = await getJson<ConversationList>(
                    conversationsRoute.url(),
                    { id },
                );
                const [row] = result.data;
                setCounts(result.counts);

                if (row) {
                    upsert(row);
                } else {
                    setRows((current) =>
                        current.filter((item) => item.id !== id),
                    );
                }
            } catch {
                // The next signal or check catches up.
            }
        },
        [upsert],
    );

    /** Shows this row as read at once (the server is told separately). */
    const markSeen = useCallback((id: number) => {
        setRows((current) =>
            current.map((row) => (row.id === id ? { ...row, unread: 0 } : row)),
        );
    }, []);

    return {
        rows,
        counts,
        tab,
        setTab,
        search,
        setSearch,
        loading,
        hasMore: nextPage !== null,
        loadMore: () => nextPage !== null && void load(nextPage),
        reload: () => void load(),
        refreshRow,
        upsert,
        markSeen,
    };
}

/**
 * One conversation's thread: loading it, earlier messages on demand,
 * sending (shown at once, confirmed by the server), and read marking.
 */
export function useThread(
    id: number | null,
    onSummary: (row: ConversationSummary) => void,
) {
    const [thread, setThread] = useState<Thread | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingEarlier, setLoadingEarlier] = useState(false);
    const current = useRef(id);
    current.current = id;
    const summary = useRef(onSummary);
    summary.current = onSummary;

    const fetchThread = useCallback(async (target: number) => {
        const result = await getJson<Thread>(showRoute.url(target));

        if (current.current !== target) {
            return;
        }

        setThread((previous) => {
            if (previous?.conversation.id !== target) {
                return result;
            }

            // Keep earlier pages already loaded and messages still sending.
            const firstId = result.messages[0]?.id ?? Infinity;
            const earlier = previous.messages.filter(
                (message) => !message.local && message.id < firstId,
            );
            const sending = previous.messages.filter(
                (message) => message.local,
            );

            return {
                ...result,
                has_earlier:
                    earlier.length > 0
                        ? previous.has_earlier
                        : result.has_earlier,
                messages: [...earlier, ...result.messages, ...sending],
            };
        });
        summary.current(result.conversation);
    }, []);

    const markRead = useCallback(async (target: number) => {
        if (document.visibilityState !== 'visible') {
            return;
        }

        try {
            const { unread } = await postJson<{ unread: number }>(
                readRoute.url(target),
            );

            router.replaceProp('messagesUnread', unread);
        } catch {
            // Read marking is a nicety; the badge catches up later.
        }
    }, []);

    const refresh = useCallback(
        async (target = current.current) => {
            if (target === null) {
                return;
            }

            try {
                await fetchThread(target);
                await markRead(target);
            } catch {
                // The next signal or check catches up.
            }
        },
        [fetchThread, markRead],
    );

    useEffect(() => {
        if (id === null) {
            setThread(null);

            return;
        }

        setLoading(true);
        setThread((previous) =>
            previous?.conversation.id === id ? previous : null,
        );
        fetchThread(id)
            .then(() => markRead(id))
            .catch(() => toast.error('This conversation could not be opened.'))
            .finally(() => setLoading(false));
    }, [id, fetchThread, markRead]);

    // Coming back to the tab reads what arrived meanwhile.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && current.current) {
                void markRead(current.current);
            }
        };

        document.addEventListener('visibilitychange', onVisible);

        return () =>
            document.removeEventListener('visibilitychange', onVisible);
    }, [markRead]);

    const loadEarlier = useCallback(async () => {
        const target = current.current;
        const first = thread?.messages.find((message) => !message.local);

        if (target === null || !first) {
            return;
        }

        setLoadingEarlier(true);

        try {
            const result = await getJson<{
                messages: ThreadMessage[];
                has_earlier: boolean;
            }>(showRoute.url(target), { before: first.id });

            setThread((previous) =>
                previous && previous.conversation.id === target
                    ? {
                          ...previous,
                          has_earlier: result.has_earlier,
                          messages: [...result.messages, ...previous.messages],
                      }
                    : previous,
            );
        } catch {
            toast.error('Earlier messages could not be loaded.');
        } finally {
            setLoadingEarlier(false);
        }
    }, [thread]);

    /** Send now; shown at once, replaced by the server's copy. */
    const send = useCallback(
        async (body: string, files: File[], retryKey?: string) => {
            const target = current.current;

            if (target === null || !thread) {
                return false;
            }

            const key = retryKey ?? `local-${Date.now()}`;
            const draft: ThreadMessage = {
                id: Number.MAX_SAFE_INTEGER,
                side: thread.conversation.mine ? 'requester' : 'office',
                body: body || null,
                mine: true,
                author: null,
                at: new Date().toISOString(),
                attachments: [],
                local: { key, failed: false, files },
            };
            const replace = (next: ThreadMessage | null) =>
                setThread((previous) =>
                    previous && previous.conversation.id === target
                        ? {
                              ...previous,
                              messages: previous.messages.flatMap((message) =>
                                  message.local?.key === key
                                      ? next
                                          ? [next]
                                          : []
                                      : [message],
                              ),
                          }
                        : previous,
                );

            setThread((previous) =>
                previous
                    ? {
                          ...previous,
                          messages: [
                              ...previous.messages.filter(
                                  (message) => message.local?.key !== key,
                              ),
                              draft,
                          ],
                      }
                    : previous,
            );

            const form = new FormData();

            if (body) {
                form.append('body', body);
            }

            files.forEach((file) => form.append('files[]', file));

            try {
                const { message } = await postForm<{ message: ThreadMessage }>(
                    sendRoute.url(target),
                    form,
                );

                replace(message);
                void refresh(target);

                return true;
            } catch (error) {
                replace({
                    ...draft,
                    local: { key, failed: true, files },
                });
                toast.error(
                    errorText(error, 'Your message was not sent. Try again.'),
                );

                return false;
            }
        },
        [thread, refresh],
    );

    const retry = useCallback(
        (message: ThreadMessage) =>
            message.local &&
            void send(
                message.body ?? '',
                message.local.files,
                message.local.key,
            ),
        [send],
    );

    return {
        thread,
        setThread,
        loading,
        loadingEarlier,
        loadEarlier,
        refresh,
        send,
        retry,
    };
}

/**
 * Live signals for the page: news in a conversation (or "look again" after
 * a reconnect or a check), and who is typing where.
 */
export function useMessagesSignals(
    onNews: (signal: MessagesSignal) => void,
): Record<number, string> {
    const [typing, setTyping] = useState<Record<number, string>>({});
    const news = useRef(onNews);
    news.current = onNews;

    useEffect(() => {
        const timers = new Map<number, number>();
        const clear = (conversation: number) =>
            setTyping((current) => {
                const next = { ...current };
                delete next[conversation];

                return next;
            });

        const stopNews = onWindow<MessagesSignal>(MESSAGES_EVENT, (signal) => {
            // A new message ends the dots of whoever sent it.
            if (signal) {
                window.clearTimeout(timers.get(signal.conversation));
                clear(signal.conversation);
            }

            news.current(signal);
        });

        const stopTyping = onWindow<TypingSignal>(TYPING_EVENT, (signal) => {
            setTyping((current) => ({
                ...current,
                [signal.conversation]: signal.name,
            }));
            window.clearTimeout(timers.get(signal.conversation));
            timers.set(
                signal.conversation,
                window.setTimeout(
                    () => clear(signal.conversation),
                    TYPING_SHOWN_MS,
                ),
            );
        });

        return () => {
            stopNews();
            stopTyping();
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, []);

    return typing;
}

/** Tells the others this person is typing, at most every few seconds. */
export function useTypingPing(conversation: number | null): () => void {
    const last = useRef(0);

    return useCallback(() => {
        if (
            conversation === null ||
            Date.now() - last.current < TYPING_EVERY_MS
        ) {
            return;
        }

        last.current = Date.now();
        void postJson(typingRoute.url(conversation)).catch(() => {});
    }, [conversation]);
}
