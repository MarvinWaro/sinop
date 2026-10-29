import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type BreadcrumbItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
};

export type NavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    /** Small count shown next to the item (e.g. pending requisitions). */
    badge?: number;
    /** Also mark active for nested pages under this path. */
    matchPrefix?: boolean;
    /** Permission needed to see this item (see useCan). */
    permission?: string;
};

export type NavGroup = {
    title: string;
    items: NavItem[];
};
