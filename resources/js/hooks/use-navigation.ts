import { usePage } from '@inertiajs/react';
import {
    BarChart3,
    BookOpen,
    Boxes,
    Building2,
    ClipboardList,
    FileSignature,
    FileSpreadsheet,
    FolderTree,
    History,
    IdCard,
    KeyRound,
    LayoutGrid,
    Laptop,
    MapPin,
    MessagesSquare,
    Package,
    PackageCheck,
    Palette,
    PenLine,
    ScrollText,
    ShieldCheck,
    Truck,
    UserRound,
    UsersRound,
} from 'lucide-react';
import { useCan } from '@/hooks/use-can';
import { dashboard } from '@/routes';
import { userDashboard } from '@/routes/admin';
import { index as activityLogsIndex } from '@/routes/activity-logs';
import { edit as editAppearance } from '@/routes/appearance';
import { dashboard as assetsDashboard } from '@/routes/assets';
import { index as categoriesIndex } from '@/routes/categories';
import { index as departmentsIndex } from '@/routes/departments';
import { index as designationsIndex } from '@/routes/designations';
import { index as locationsIndex } from '@/routes/location';
import { index as messagesIndex } from '@/routes/messages';
import { edit as editProfile } from '@/routes/profile';
import { index as propertiesIndex } from '@/routes/property';
import { index as risIndex } from '@/routes/ris';
import { edit as editRisSignatory } from '@/routes/ris-signatory';
import { index as rolesIndex } from '@/routes/roles';
import { index as rpciIndex } from '@/routes/rpci';
import { index as rsmiIndex } from '@/routes/rsmi';
import { edit as editSecurity } from '@/routes/security';
import { edit as editSignature } from '@/routes/signature';
import {
    properties as staffProperties,
    received as staffReceived,
    requests as staffRequests,
    dashboard as staffDashboard,
} from '@/routes/staff';
import { index as stockCardsIndex } from '@/routes/stock-cards';
import { index as stocksIndex } from '@/routes/stocks';
import { index as supplierIndex } from '@/routes/supplier';
import { index as suppliesIndex } from '@/routes/supplies';
import { index as ledgerCardsIndex } from '@/routes/supply-ledger-cards';
import { index as transactionsIndex } from '@/routes/supply-transactions';
import { index as usersIndex } from '@/routes/users';
import type { NavGroup, NavItem } from '@/types';

/** Settings menu, "Account": every signed-in user. */
export const accountSettingsNav: NavGroup = {
    title: 'Account',
    items: [
        { title: 'Profile', href: editProfile(), icon: UserRound },
        { title: 'E-Signature', href: editSignature(), icon: PenLine },
        { title: 'Security', href: editSecurity(), icon: ShieldCheck },
        { title: 'Appearance', href: editAppearance(), icon: Palette },
    ],
};

/**
 * Admin-side settings groups. Each item shows only to people whose roles
 * include its permission (see settingsNavFor).
 */
export const adminSettingsNav: NavGroup[] = [
    {
        title: 'User management',
        items: [
            {
                title: 'Users',
                href: usersIndex(),
                icon: UsersRound,
                permission: 'users.view',
            },
            {
                title: 'Roles & permissions',
                href: rolesIndex(),
                icon: KeyRound,
                permission: 'roles.view',
            },
        ],
    },
    {
        title: 'System configuration',
        items: [
            {
                title: 'Divisions',
                href: departmentsIndex(),
                icon: Building2,
                permission: 'divisions.view',
            },
            {
                title: 'Designations',
                href: designationsIndex(),
                icon: IdCard,
                permission: 'designations.view',
            },
            {
                title: 'Categories',
                href: categoriesIndex(),
                icon: FolderTree,
                permission: 'categories.view',
            },
            {
                title: 'Suppliers',
                href: supplierIndex(),
                icon: Truck,
                permission: 'suppliers.view',
            },
            {
                title: 'Locations',
                href: locationsIndex(),
                icon: MapPin,
                permission: 'locations.view',
            },
            {
                title: 'RIS signatory',
                href: editRisSignatory(),
                icon: FileSignature,
                permission: 'settings.ris-signatory',
            },
            {
                title: 'Activity logs',
                href: activityLogsIndex(),
                icon: History,
                permission: 'activity-logs.view',
            },
        ],
    },
];

/** Every admin-side settings page, flattened (for "is a settings page open"). */
export const adminSettingsItems: NavItem[] = adminSettingsNav.flatMap(
    (group) => group.items,
);

/** Keep the items the user may open; drop groups left empty. */
function allowed(
    groups: NavGroup[],
    can: (permission: string) => boolean,
): NavGroup[] {
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) => !item.permission || can(item.permission),
            ),
        }))
        .filter((group) => group.items.length > 0);
}

/** The admin-side settings groups this user may open. */
export function settingsNavFor(
    can: (permission: string) => boolean,
): NavGroup[] {
    return allowed(adminSettingsNav, can);
}

/**
 * Sidebar navigation from the user's permissions. People without the admin
 * side (and admin-side users in "user mode") only see their home dashboard.
 */
export function useNavigation(): NavGroup[] {
    const { auth, notifications } = usePage().props;
    const can = useCan();

    if (!auth.user) {
        return [];
    }

    // Requests and concerns with the supply office (a preview for now).
    const messagesItem: NavItem = {
        title: 'Messages',
        href: messagesIndex(),
        icon: MessagesSquare,
    };

    if (!can('dashboard.view') || auth.isAdminUserMode) {
        return [
            {
                title: 'Overview',
                items: [
                    {
                        title: 'Dashboard',
                        href: auth.isAdminUserMode
                            ? userDashboard()
                            : staffDashboard(),
                        icon: LayoutGrid,
                    },
                    messagesItem,
                ],
            },
            {
                title: 'Requisitions',
                items: [
                    {
                        title: 'My requests',
                        href: staffRequests(),
                        icon: ClipboardList,
                        // Also on New request (/my-requests/new).
                        matchPrefix: true,
                        // Approved, waiting to be issued.
                        badge: notifications?.approved_requests_count ?? 0,
                    },
                    {
                        title: 'Received supplies',
                        href: staffReceived(),
                        icon: PackageCheck,
                        // Issued to them, waiting for their confirmation.
                        badge: notifications?.pending_receipt_count ?? 0,
                    },
                ],
            },
            {
                title: 'Property',
                items: [
                    {
                        title: 'My properties',
                        href: staffProperties(),
                        icon: Laptop,
                    },
                ],
            },
        ];
    }

    // Issuers see approved requests waiting to be issued; approvers see new drafts.
    const risBadge = can('ris.issue')
        ? (notifications?.approved_count ?? 0)
        : can('ris.approve')
          ? (notifications?.draft_count ?? 0)
          : 0;

    return allowed(
        [
            {
                title: 'Overview',
                items: [
                    {
                        title: 'Dashboard',
                        href: dashboard(),
                        icon: LayoutGrid,
                        permission: 'dashboard.view',
                    },
                    messagesItem,
                ],
            },
            {
                title: 'Supplies',
                items: [
                    {
                        title: 'Supplies',
                        href: suppliesIndex(),
                        icon: Package,
                        permission: 'supplies.view',
                    },
                    {
                        title: 'Stocks (IAR)',
                        href: stocksIndex(),
                        icon: Boxes,
                        permission: 'stocks.view',
                    },
                    {
                        title: 'Requisitions (RIS)',
                        href: risIndex(),
                        icon: ClipboardList,
                        badge: risBadge,
                        matchPrefix: true,
                        permission: 'ris.view',
                    },
                    {
                        title: 'Transactions',
                        href: transactionsIndex(),
                        icon: History,
                        permission: 'transactions.view',
                    },
                    {
                        title: 'Stock Cards',
                        href: stockCardsIndex(),
                        icon: ScrollText,
                        matchPrefix: true,
                        permission: 'stock-cards.view',
                    },
                    {
                        title: 'Ledger Cards',
                        href: ledgerCardsIndex(),
                        icon: BookOpen,
                        matchPrefix: true,
                        permission: 'ledger-cards.view',
                    },
                ],
            },
            {
                title: 'Reports',
                items: [
                    {
                        title: 'RSMI',
                        href: rsmiIndex(),
                        icon: BarChart3,
                        matchPrefix: true,
                        permission: 'rsmi.view',
                    },
                    {
                        title: 'RPCI',
                        href: rpciIndex(),
                        icon: FileSpreadsheet,
                        matchPrefix: true,
                        permission: 'rpci.view',
                    },
                ],
            },
            {
                title: 'Properties',
                items: [
                    {
                        title: 'Assets Overview',
                        href: assetsDashboard(),
                        icon: PackageCheck,
                        permission: 'assets.view',
                    },
                    {
                        title: 'Properties',
                        href: propertiesIndex(),
                        icon: Laptop,
                        matchPrefix: true,
                        permission: 'properties.view',
                    },
                ],
            },
        ],
        can,
    );
}
