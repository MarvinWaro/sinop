import type {
    Auth,
    BroadcastingConfig,
    NotificationCounts,
} from '@/types/auth';
import type { Inbox } from '@/types/notifications';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            notifications: NotificationCounts | null;
            inbox: Inbox | null;
            /** Messages the person hasn't read (the Messages badge). */
            messagesUnread: number;
            broadcasting: BroadcastingConfig | null;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
