import { useLayoutEffect, useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

type Placement = {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
};

const ACTIVE_ITEM = '[data-sidebar="menu-button"][data-active="true"]';

/** Where the tab last sat, so a redrawn sidebar glides on from there. */
let lastPlacement: Placement | null = null;

function samePlace(a: Placement, b: Placement): boolean {
    return (
        a.visible === b.visible &&
        Math.abs(a.x - b.x) < 0.5 &&
        Math.abs(a.y - b.y) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
    );
}

/**
 * The active sidebar item as a notch: a tab in the page's colour that runs
 * into the content panel, so the panel seems to bulge out to meet the item.
 * It glides between items on a soft spring (styles: `.sidebar-notch` in
 * app.css). Desktop only: on phones the sidebar is a sheet with no panel
 * beside it, so items keep their usual highlight.
 */
export function SidebarNotch() {
    const { isMobile } = useSidebar();
    const ref = useRef<HTMLSpanElement>(null);

    useLayoutEffect(() => {
        const tab = ref.current;
        const sidebar = tab?.parentElement;

        if (!tab || !sidebar) {
            return;
        }

        const content = sidebar.querySelector<HTMLElement>(
            '[data-sidebar="content"]',
        );

        // Glides animate; scrolling and resizing move it at once (a fade in
        // or out still eases).
        const apply = (placement: Placement, glide: boolean) => {
            if (!glide) {
                tab.style.transition = 'opacity 150ms ease';
            }

            tab.style.setProperty('--notch-x', `${placement.x}px`);
            tab.style.setProperty('--notch-y', `${placement.y}px`);
            tab.style.setProperty('--notch-w', `${placement.width}px`);
            tab.style.setProperty('--notch-h', `${placement.height}px`);
            tab.toggleAttribute('data-hidden', !placement.visible);

            if (!glide) {
                void tab.offsetWidth;
                tab.style.transition = '';
            }

            lastPlacement = placement;
        };

        const measure = (): Placement | null => {
            const item = sidebar.querySelector(ACTIVE_ITEM);
            const panel = document.querySelector('[data-slot="sidebar-inset"]');
            const origin = tab.offsetParent;

            if (!item || !panel || !origin) {
                return null;
            }

            const box = item.getBoundingClientRect();
            const from = origin.getBoundingClientRect();
            // An item scrolled out of the list hides the tab instead of
            // drawing it over the header or footer.
            const region = (
                item.closest('[data-sidebar="content"]') ?? sidebar
            ).getBoundingClientRect();

            return {
                x: box.left - from.left,
                y: box.top - from.top,
                // Up to the panel's edge and 1px under it, so they join.
                width: panel.getBoundingClientRect().left - box.left + 1,
                height: box.height,
                visible:
                    box.top >= region.top - 1 &&
                    box.bottom <= region.bottom + 1,
            };
        };

        const place = (glide: boolean) => {
            const next = measure();
            const showing = !tab.hasAttribute('data-hidden');

            if (!next) {
                tab.toggleAttribute('data-hidden', true);

                return;
            }

            // Nothing moved: leave it, so a glide under way isn't cut short.
            if (
                lastPlacement &&
                showing === next.visible &&
                samePlace(next, lastPlacement)
            ) {
                return;
            }

            // Only a tab already showing glides; one appearing fades in place.
            apply(next, glide && showing);
        };

        let frame = 0;
        let glidePending = false;
        const schedule = (glide: boolean) => {
            glidePending ||= glide;

            if (!frame) {
                frame = requestAnimationFrame(() => {
                    frame = 0;
                    const glideNow = glidePending;
                    glidePending = false;
                    place(glideNow);
                });
            }
        };

        // A sidebar drawn again starts where the last one left off.
        if (lastPlacement) {
            apply(lastPlacement, false);
        }

        place(true);

        const mutations = new MutationObserver(() => schedule(true));
        mutations.observe(sidebar, {
            subtree: true,
            childList: true,
            attributeFilter: ['data-active'],
        });

        const resizes = new ResizeObserver(() => schedule(false));
        resizes.observe(sidebar);

        const onScroll = () => schedule(false);
        content?.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            cancelAnimationFrame(frame);
            mutations.disconnect();
            resizes.disconnect();
            content?.removeEventListener('scroll', onScroll);
        };
    }, [isMobile]);

    if (isMobile) {
        return null;
    }

    return (
        <span
            ref={ref}
            aria-hidden="true"
            data-hidden=""
            className="sidebar-notch"
        />
    );
}
