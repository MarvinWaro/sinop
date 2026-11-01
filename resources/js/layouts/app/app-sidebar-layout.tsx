import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { useInboxUpdates } from '@/hooks/use-inbox';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    // The bell and sidebar badges: live updates, or checks now and then.
    useInboxUpdates();

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar" className="min-w-0 overflow-x-clip">
                <AppSidebarHeader breadcrumbs={breadcrumbs} />
                {children}
                {/* Room under the last row for the phone tab bar. */}
                <div aria-hidden className="h-24 shrink-0 md:hidden" />
            </AppContent>
            <MobileTabBar />
        </AppShell>
    );
}
