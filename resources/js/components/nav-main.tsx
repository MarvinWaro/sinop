import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavGroup, NavItem } from '@/types';

export function NavMain({ groups }: { groups: NavGroup[] }) {
    return (
        <>
            {groups.map((group) => (
                <NavSection
                    key={group.title}
                    title={group.title}
                    items={group.items}
                />
            ))}
        </>
    );
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
    const { isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{title}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={
                                item.matchPrefix
                                    ? isCurrentOrParentUrl(item.href)
                                    : isCurrentUrl(item.href)
                            }
                            tooltip={{ children: item.title }}
                        >
                            <Link href={item.href} prefetch="click">
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                        {item.badge ? (
                            // Something waiting: a red count, like the header's.
                            <SidebarMenuBadge className="h-5 min-w-5 rounded-full bg-alert px-1.5 text-[11px] font-semibold text-white shadow-alert peer-hover/menu-button:text-white peer-data-[active=true]/menu-button:text-white">
                                {item.badge > 99 ? '99+' : item.badge}
                            </SidebarMenuBadge>
                        ) : null}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}
