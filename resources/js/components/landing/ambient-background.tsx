import { useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { cn } from '@/lib/utils';

/** A soft round light (radial gradient, no blur filter: cheap to animate). */
function glow(color: string, strength: number): CSSProperties {
    return {
        background: `radial-gradient(closest-side, color-mix(in oklab, ${color} ${strength}%, transparent), transparent)`,
    };
}

function dotGrid(color: string, mask: string): CSSProperties {
    return {
        backgroundImage: `radial-gradient(${color} 1px, transparent 1.5px)`,
        backgroundSize: '22px 22px',
        maskImage: mask,
        WebkitMaskImage: mask,
    };
}

const fadeOut = 'linear-gradient(to bottom, black 65%, transparent)';

const baseDots = dotGrid(
    'color-mix(in oklab, var(--foreground) 14%, transparent)',
    'radial-gradient(ellipse 75% 65% at 50% 35%, black 25%, transparent 75%)',
);

const spotDots: CSSProperties = {
    ...dotGrid(
        'color-mix(in oklab, var(--ring) 75%, transparent)',
        'radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 30%), black, transparent)',
    ),
    opacity: 'var(--spot-opacity, 0)',
};

/**
 * Tracks the mouse over an element as CSS variables (--spot-x, --spot-y,
 * --spot-opacity) for AmbientBackground's spotlight. Updates are batched to
 * one per frame and written straight to the element, so React never
 * re-renders while the mouse moves.
 */
export function useSpotlight<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const frame = useRef(0);

    useEffect(() => () => cancelAnimationFrame(frame.current), []);

    const onPointerMove = (event: PointerEvent<T>) => {
        if (event.pointerType !== 'mouse') {
            return;
        }

        const { clientX, clientY } = event;

        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
            const element = ref.current;

            if (!element) {
                return;
            }

            const rect = element.getBoundingClientRect();
            element.style.setProperty('--spot-x', `${clientX - rect.left}px`);
            element.style.setProperty('--spot-y', `${clientY - rect.top}px`);
            element.style.setProperty('--spot-opacity', '1');
        });
    };

    const onPointerLeave = () => {
        cancelAnimationFrame(frame.current);
        ref.current?.style.setProperty('--spot-opacity', '0');
    };

    return { ref, onPointerMove, onPointerLeave };
}

/**
 * Decorative light behind the landing hero: slow "aurora" glows in the
 * theme's accent blue and a dot grid that brightens around the mouse (see
 * useSpotlight). The glows hold still when reduced motion is on.
 */
export function AmbientBackground({ className }: { className?: string }) {
    return (
        <div
            aria-hidden
            className={cn(
                'pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-hidden',
                className,
            )}
            style={{ maskImage: fadeOut, WebkitMaskImage: fadeOut }}
        >
            <div
                className="absolute -top-56 -right-40 size-[46rem] will-change-transform motion-safe:animate-aurora"
                style={glow('var(--ring)', 30)}
            />
            <div
                className="absolute top-40 -left-56 size-[40rem] will-change-transform motion-safe:animate-aurora"
                style={{
                    ...glow('var(--ring)', 20),
                    animationDuration: '32s',
                    animationDelay: '-10s',
                    animationDirection: 'alternate-reverse',
                }}
            />
            <div
                className="absolute top-24 right-[18%] size-[26rem] will-change-transform motion-safe:animate-aurora"
                style={{
                    ...glow('var(--ring)', 18),
                    animationDuration: '20s',
                    animationDelay: '-6s',
                }}
            />
            <div className="absolute inset-0" style={baseDots} />
            <div
                className="absolute inset-0 transition-opacity duration-500"
                style={spotDots}
            />
        </div>
    );
}

/**
 * Faint grid lines and glows for a coloured panel (see brandPanel). Drawn in
 * the panel's text colour, or --panel-glow for the glows when it's set.
 */
export function BandPattern({ className }: { className?: string }) {
    const lines = 'color-mix(in oklab, currentColor 9%, transparent)';
    const mask =
        'radial-gradient(ellipse 90% 80% at 70% 20%, black 20%, transparent 75%)';
    const glowColor = 'var(--panel-glow, currentColor)';

    return (
        <div
            aria-hidden
            className={cn(
                'pointer-events-none absolute inset-0 overflow-hidden',
                className,
            )}
        >
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `linear-gradient(to right, ${lines} 1px, transparent 1px), linear-gradient(to bottom, ${lines} 1px, transparent 1px)`,
                    backgroundSize: '44px 44px',
                    maskImage: mask,
                    WebkitMaskImage: mask,
                }}
            />
            <div
                className="absolute -top-40 -right-32 size-[36rem] will-change-transform motion-safe:animate-aurora"
                style={glow(glowColor, 22)}
            />
            <div
                className="absolute -bottom-48 -left-40 size-[32rem] will-change-transform motion-safe:animate-aurora"
                style={{
                    ...glow(glowColor, 12),
                    animationDuration: '30s',
                    animationDirection: 'alternate-reverse',
                }}
            />
        </div>
    );
}

/**
 * The coloured panel (sign-in side panel, landing call to action): the
 * theme's band colour in light mode, a deep accent-tinted card in dark mode.
 * Content inside should use currentColor shades (opacity) so it reads in both.
 */
export const brandPanel = {
    surface:
        'bg-band text-band-foreground dark:bg-[color-mix(in_oklab,var(--ring)_12%,var(--card))] dark:text-foreground dark:ring-1 dark:ring-white/10 dark:ring-inset dark:[--panel-glow:var(--ring)]',
    solidButton:
        'border-transparent bg-card text-card-foreground shadow-sm hover:bg-card/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90',
    outlineButton:
        'border border-current/25 bg-current/10 text-current shadow-none hover:bg-current/20',
};
