import { Link, router, usePage } from '@inertiajs/react';
import { Boxes, Laptop, Menu, Package, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';
import { useCan } from '@/hooks/use-can';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigation } from '@/hooks/use-navigation';
import { openOnArrival } from '@/lib/open-on-arrival';
import { cn } from '@/lib/utils';
import { create as createProperty } from '@/routes/property';
import { newRequest } from '@/routes/staff';
import { index as stocksIndex } from '@/routes/stocks';
import { index as suppliesIndex } from '@/routes/supplies';
import type { NavItem } from '@/types';

/** The sidebar items that become tabs, first allowed ones win (3 fit). */
const TAB_CANDIDATES = {
    office: ['Dashboard', 'Stocks (IAR)', 'Requisitions (RIS)', 'Properties'],
    staff: ['Dashboard', 'My requests', 'Received supplies', 'Messages'],
};

/** Short labels for a 5-slot bar. */
const SHORT_LABELS: Record<string, string> = {
    Dashboard: 'Home',
    'Stocks (IAR)': 'Stocks',
    'Requisitions (RIS)': 'RIS',
    Properties: 'Property',
    'My requests': 'Requests',
    'Received supplies': 'Received',
};

/**
 * Pages with their own bottom bar or a full-height layout (the chat, the
 * request form's summary bar), where the tab bar would cover controls.
 */
const HIDDEN_ON = new Set(['messages/index', 'staff/request-create']);

type QuickAction = { label: string; icon: LucideIcon; run: () => void };

/**
 * Phone navigation: a floating bar with the three main pages, More (the
 * full sidebar) and a raised + in the middle that fans out quick actions
 * (New IAR, Add supply, Add property; staff go straight to New request).
 */
export function MobileTabBar() {
    const isMobile = useIsMobile();
    const keyboardOpen = useKeyboardOpen();
    const { component, props } = usePage();
    const can = useCan();
    const groups = useNavigation();
    const { setOpenMobile } = useSidebar();
    const { isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();
    const [fanOpen, setFanOpen] = useState(false);

    const office = can('dashboard.view') && !props.auth.isAdminUserMode;
    const items = groups.flatMap((group) => group.items);
    const tabs = (office ? TAB_CANDIDATES.office : TAB_CANDIDATES.staff)
        .map((title) => items.find((item) => item.title === title))
        .filter((item): item is NavItem => item !== undefined)
        .slice(0, 3);
    // Badges of pages only reachable through More (e.g. unread messages).
    const moreBadge = items
        .filter((item) => !tabs.includes(item))
        .reduce((sum, item) => sum + (item.badge ?? 0), 0);

    const go = (visit: () => void) => {
        setFanOpen(false);
        visit();
    };
    const actions: QuickAction[] = office
        ? [
              can('stocks.create') && {
                  label: 'New IAR',
                  icon: Boxes,
                  run: () =>
                      go(() => {
                          openOnArrival('new-iar');
                          router.visit(stocksIndex());
                      }),
              },
              can('supplies.create') && {
                  label: 'Add supply',
                  icon: Package,
                  run: () =>
                      go(() => {
                          openOnArrival('new-supply');
                          router.visit(suppliesIndex());
                      }),
              },
              can('properties.create') && {
                  label: 'Add property',
                  icon: Laptop,
                  run: () => go(() => router.visit(createProperty())),
              },
          ].filter((action): action is QuickAction => Boolean(action))
        : can('ris.request')
          ? [
                {
                    label: 'New request',
                    icon: Plus,
                    run: () => go(() => router.visit(newRequest())),
                },
            ]
          : [];

    // Close the fan on Escape and whenever another page opens.
    useEffect(() => {
        if (!fanOpen) {
            return;
        }

        const onKey = (event: KeyboardEvent) =>
            event.key === 'Escape' && setFanOpen(false);
        const stop = router.on('start', () => setFanOpen(false));
        window.addEventListener('keydown', onKey);

        return () => {
            window.removeEventListener('keydown', onKey);
            stop();
        };
    }, [fanOpen]);

    if (!isMobile || keyboardOpen || HIDDEN_ON.has(component)) {
        return null;
    }

    const active = (item: NavItem) =>
        item.matchPrefix
            ? isCurrentOrParentUrl(item.href)
            : isCurrentUrl(item.href);
    const [left, right] = [tabs.slice(0, 2), tabs.slice(2)];

    return (
        <>
            {fanOpen && (
                <button
                    type="button"
                    aria-label="Close quick actions"
                    onClick={() => setFanOpen(false)}
                    className="fixed inset-0 z-40 animate-in bg-background/70 backdrop-blur-[2px] duration-200 fade-in"
                />
            )}
            <nav
                aria-label="Main"
                className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 [view-transition-name:mobile-tab-bar]"
            >
                <div className="grid h-16 grid-cols-5 items-center rounded-2xl border bg-background/90 px-1 shadow-lg backdrop-blur-md">
                    {left.map((item) => (
                        <Tab
                            key={item.title}
                            item={item}
                            active={active(item)}
                        />
                    ))}
                    {left.length < 2 && <span />}

                    <div className="relative flex justify-center">
                        {actions.length > 0 && (
                            <>
                                {actions.length > 1 && (
                                    <Fan actions={actions} open={fanOpen} />
                                )}
                                <button
                                    type="button"
                                    onClick={() =>
                                        actions.length === 1
                                            ? actions[0].run()
                                            : setFanOpen((open) => !open)
                                    }
                                    aria-label={
                                        actions.length === 1
                                            ? actions[0].label
                                            : 'Quick actions'
                                    }
                                    aria-expanded={
                                        actions.length > 1 ? fanOpen : undefined
                                    }
                                    className="-mt-8 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 shadow-primary/30 ring-background transition-transform outline-none focus-visible:ring-ring active:scale-95"
                                >
                                    <Plus
                                        className={cn(
                                            'size-6 transition-transform duration-300',
                                            fanOpen && 'rotate-45',
                                        )}
                                    />
                                </button>
                            </>
                        )}
                    </div>

                    {right.map((item) => (
                        <Tab
                            key={item.title}
                            item={item}
                            active={active(item)}
                        />
                    ))}
                    {right.length < 1 && <span />}

                    <button
                        type="button"
                        onClick={() => setOpenMobile(true)}
                        className="relative flex h-full flex-col items-center justify-center gap-1 text-muted-foreground outline-none focus-visible:text-foreground"
                    >
                        <span className="relative flex h-7 w-12 items-center justify-center">
                            <Menu className="size-5" />
                            <Badge count={moreBadge} />
                        </span>
                        <span className="text-[10px] leading-none font-medium">
                            More
                        </span>
                    </button>
                </div>
            </nav>
        </>
    );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            prefetch
            aria-current={active ? 'page' : undefined}
            className={cn(
                'flex h-full flex-col items-center justify-center gap-1 transition-colors outline-none',
                active
                    ? 'text-primary'
                    : 'text-muted-foreground focus-visible:text-foreground',
            )}
        >
            <span
                className={cn(
                    'relative flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-300',
                    active && 'bg-primary/12',
                )}
            >
                {Icon && <Icon className="size-5" />}
                <Badge count={item.badge ?? 0} />
            </span>
            <span className="text-[10px] leading-none font-medium">
                {SHORT_LABELS[item.title] ?? item.title}
            </span>
        </Link>
    );
}

function Badge({ count }: { count: number }) {
    return count > 0 ? (
        <span className="absolute -top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert px-1 text-[10px] leading-none font-semibold text-white shadow-alert">
            {count > 99 ? '99+' : count}
        </span>
    ) : null;
}

/** The quick actions on an arc above the + button. */
function Fan({ actions, open }: { actions: QuickAction[]; open: boolean }) {
    const radius = 92;
    // Spread evenly between 150° and 30° (left to right over the button).
    const angles = actions.map((_, index) =>
        actions.length === 1 ? 90 : 150 - (120 / (actions.length - 1)) * index,
    );

    return (
        <div className="pointer-events-none absolute bottom-6 left-1/2">
            {actions.map((action, index) => {
                const angle = (angles[index] * Math.PI) / 180;
                const x = Math.cos(angle) * radius;
                const y = -Math.sin(angle) * radius;
                const Icon = action.icon;

                return (
                    <button
                        key={action.label}
                        type="button"
                        onClick={action.run}
                        tabIndex={open ? 0 : -1}
                        aria-hidden={!open}
                        className={cn(
                            'absolute flex w-20 flex-col items-center gap-1.5 outline-none',
                            open
                                ? 'pointer-events-auto'
                                : 'pointer-events-none',
                        )}
                        style={{
                            left: 0,
                            bottom: 0,
                            transform: open
                                ? `translate(calc(-50% + ${x}px), ${y}px) scale(1)`
                                : 'translate(-50%, 24px) scale(0.4)',
                            opacity: open ? 1 : 0,
                            transition:
                                'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease',
                            transitionDelay: open ? `${index * 40}ms` : '0ms',
                        }}
                    >
                        <span className="flex size-12 items-center justify-center rounded-full border bg-card text-foreground shadow-md transition-colors hover:bg-muted">
                            <Icon className="size-5" />
                        </span>
                        <span className="rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap shadow-xs">
                            {action.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** True while the on-screen keyboard covers the bottom of the screen. */
function useKeyboardOpen(): boolean {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const viewport = window.visualViewport;

        if (!viewport) {
            return;
        }

        const check = () => setOpen(window.innerHeight - viewport.height > 150);
        viewport.addEventListener('resize', check);

        return () => viewport.removeEventListener('resize', check);
    }, []);

    return open;
}
