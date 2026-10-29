import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useCan } from '@/hooks/use-can';
import {
    accountSettingsNav,
    adminSettingsItems,
    settingsNavFor,
} from '@/hooks/use-navigation';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import type { NavGroup } from '@/types';

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { auth } = usePage().props;
    const can = useCan();

    // Admin-side settings show only what the user's roles allow, and not in user mode.
    const groups = auth.isAdminUserMode
        ? [accountSettingsNav]
        : [accountSettingsNav, ...settingsNavFor(can)];

    // Lists fill the width; short forms stay narrow, where they read best.
    const isListPage = adminSettingsItems.some((item) =>
        isCurrentOrParentUrl(item.href),
    );
    const isAppearancePage = isCurrentOrParentUrl(editAppearance());

    return (
        <div className="px-4 py-6 md:px-6">
            <Heading
                title="Settings"
                description="Manage your profile and account settings"
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-start">
                    <nav className="flex flex-col gap-5" aria-label="Settings">
                        {groups.map((group) => (
                            <SettingsNavGroup
                                key={group.title}
                                group={group}
                                isCurrentOrParentUrl={isCurrentOrParentUrl}
                            />
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div
                    className={cn(
                        'min-w-0 flex-1',
                        !isListPage &&
                            (isAppearancePage
                                ? 'md:max-w-3xl'
                                : 'md:max-w-2xl'),
                    )}
                >
                    <section
                        className={cn(
                            'space-y-12',
                            !isListPage &&
                                (isAppearancePage ? 'max-w-3xl' : 'max-w-xl'),
                        )}
                    >
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}

function SettingsNavGroup({
    group,
    isCurrentOrParentUrl,
}: {
    group: NavGroup;
    isCurrentOrParentUrl: ReturnType<
        typeof useCurrentUrl
    >['isCurrentOrParentUrl'];
}) {
    return (
        <div className="flex flex-col gap-1">
            <p className="mb-1 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {group.title}
            </p>
            {group.items.map((item) => (
                <Button
                    key={toUrl(item.href)}
                    size="sm"
                    variant="ghost"
                    asChild
                    className={cn('w-full justify-start', {
                        'bg-muted text-foreground': isCurrentOrParentUrl(
                            item.href,
                        ),
                    })}
                >
                    <Link href={item.href} prefetch="click">
                        {item.icon && <item.icon className="size-4" />}
                        {item.title}
                    </Link>
                </Button>
            ))}
        </div>
    );
}
