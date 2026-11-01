import { Link, router, usePage } from '@inertiajs/react';
import { Settings } from 'lucide-react';
import { useEffect } from 'react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { SidebarNotch } from '@/components/sidebar-notch';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { useCan } from '@/hooks/use-can';
import { useCurrentUrl } from '@/hooks/use-current-url';
import {
    accountSettingsNav,
    adminSettingsItems,
    settingsNavFor,
    useNavigation,
} from '@/hooks/use-navigation';
import { dashboard } from '@/routes';
import { userDashboard } from '@/routes/admin';
import { edit as editProfile } from '@/routes/profile';
import { dashboard as staffDashboard } from '@/routes/staff';

const settingsItems = [...accountSettingsNav.items, ...adminSettingsItems];

export function AppSidebar() {
    const { auth } = usePage().props;
    const { setOpenMobile } = useSidebar();

    // On phones the sidebar is a drawer: close it as soon as a link is
    // followed, so the new page isn't hidden behind it.
    useEffect(
        () => router.on('start', () => setOpenMobile(false)),
        [setOpenMobile],
    );
    const groups = useNavigation();
    const can = useCan();
    const { isCurrentOrParentUrl } = useCurrentUrl();

    const homeHref = !can('dashboard.view')
        ? staffDashboard()
        : auth.isAdminUserMode
          ? userDashboard()
          : dashboard();

    // Users and the reference lists live under Settings, so anyone who may
    // open one of them gets a direct link, not only the one in the user menu.
    const showSettings =
        !auth.isAdminUserMode && settingsNavFor(can).length > 0;
    const settingsActive = settingsItems.some((item) =>
        isCurrentOrParentUrl(item.href),
    );

    return (
        // Its own view-transition layer, so page changes don't fade it and the
        // notch glides in plain sight (app.css).
        <Sidebar
            collapsible="icon"
            variant="inset"
            className="[view-transition-name:app-sidebar]"
        >
            <SidebarNotch />

            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={homeHref} prefetch="click">
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain groups={groups} />
            </SidebarContent>

            <SidebarFooter>
                {showSettings && (
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                isActive={settingsActive}
                                tooltip={{ children: 'Settings' }}
                            >
                                <Link href={editProfile()} prefetch="click">
                                    <Settings />
                                    <span>Settings</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                )}
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
