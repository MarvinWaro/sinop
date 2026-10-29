import type {
    Auth,
    BroadcastingConfig,
    NotificationCounts,
} from '@/types/auth';

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
            broadcasting: BroadcastingConfig;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
