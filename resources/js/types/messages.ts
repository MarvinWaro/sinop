import type { RisStatus } from '@/types/models';

/**
 * Messages between requesters and the supply office, as
 * App\Http\Controllers\MessageController sends them.
 */

export type MessageSide = 'requester' | 'office' | 'system';

export type ConversationKind = 'request' | 'concern' | 'general';

/** open: answered; waiting: for the office; resolved. */
export type ConversationStatus = 'open' | 'waiting' | 'resolved';

export type MessagePerson = {
    id: number;
    name: string;
    photo: string | null;
    division: string | null;
    role: string | null;
};

export type ConversationRis = {
    key: string;
    no: string;
    status: RisStatus;
    received_at: string | null;
};

export type ConversationSummary = {
    id: number;
    kind: ConversationKind;
    subject: string;
    status: ConversationStatus;
    /** The viewer is its requester. */
    mine: boolean;
    requester: MessagePerson | null;
    /** The officer who replied last, if anyone has. */
    replied_by: MessagePerson | null;
    last: {
        side: MessageSide;
        body: string | null;
        files: number;
        author: { id: number; name: string } | null;
        at: string;
    } | null;
    unread: number;
    ris: ConversationRis | null;
    updated_at: string | null;
};

export type MessagesTab = 'all' | 'request' | 'concern' | 'waiting';

export type ConversationList = {
    data: ConversationSummary[];
    next_page: number | null;
    counts: Partial<Record<MessagesTab, number>>;
};

export type MessageFile = {
    id: number;
    name: string;
    mime: string;
    size: number;
    url: string;
};

export type ThreadMessage = {
    id: number;
    side: MessageSide;
    /** For `system` lines: `resolved` or `reopened`. */
    body: string | null;
    mine: boolean;
    author: MessagePerson | null;
    at: string;
    attachments: MessageFile[];
    /** Shown before the server has it (sending), or after it refused it. */
    local?: { key: string; failed: boolean; files: File[] };
};

/** Something that happened to the request (approved, issued…). */
export type ThreadEvent = {
    id: string;
    action: string;
    body: string;
    at: string;
};

export type ThreadContext = {
    ris: {
        key: string;
        no: string;
        status: RisStatus;
        received_at: string | null;
        requested_at: string | null;
        purpose: string | null;
        division: string | null;
        items: { name: string; quantity: number; unit: string | null }[];
    } | null;
    property: {
        number: string;
        name: string;
        condition: string | null;
        location: string | null;
    } | null;
};

export type Thread = {
    conversation: ConversationSummary;
    messages: ThreadMessage[];
    has_earlier: boolean;
    events: ThreadEvent[];
    context: ThreadContext;
    /** Everyone who answers for the supply office. */
    office: MessagePerson[];
};

/** What the page was asked to open (`?ris=` or `?c=`). */
export type MessagesOpening =
    | { conversation: number }
    | { ris: { id: number; no: string }; requester: MessagePerson }
    | null;

/** What a new conversation can be about. */
export type MessageOptions = {
    requests: {
        id: number;
        no: string;
        status: RisStatus;
        received_at: string | null;
        requested_at: string | null;
    }[];
    properties: { id: number; number: string; name: string }[];
};

/** Sent over the WebSocket: a conversation has news, or someone types. */
export type MessagesSignal = { conversation: number } | undefined;
export type TypingSignal = { conversation: number; name: string };
