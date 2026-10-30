/** Shapes from App\Http\Resources\NotificationResource and NotificationInbox. */

/** The bell's counts (shared prop `inbox`). */
export type Inbox = {
    unread: number;
    /** When the newest notification arrived (ISO, UTC). */
    latest_at: string | null;
};

export type NotificationTone = 'positive' | 'info' | 'warning' | 'danger';

export type AppNotification = {
    id: string;
    kind: { code: string; label: string; tone: NotificationTone };
    module: { code: string; label: string };
    /** Null for system notices (stock alerts, sign-ups). */
    actor: { name: string; avatar: string | null } | null;
    /** The sentence around the record's name, which is shown bold. */
    sentence: { before: string; subject: string | null; after: string };
    read_at: string | null;
    created_at: string;
};

/** A cursor page from `notifications.recent`. */
export type NotificationPage = {
    data: AppNotification[];
    meta: { next_cursor: string | null };
    inbox: Inbox;
};

export type NotificationFilters = {
    status: string;
    search: string;
    kind: string;
    module: string;
};
