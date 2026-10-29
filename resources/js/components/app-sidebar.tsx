import { Link, usePage } from '@inertiajs/react';
import { Settings } from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
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
        <Sidebar collapsible="icon" variant="inset">
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
