import { useLayoutEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { setAppearanceOverride } from '@/hooks/use-appearance';
import type { ResolvedAppearance } from '@/hooks/use-appearance';

// Same name for the cookie (read by HandleAppearance) and localStorage.
const STORAGE_KEY = 'public_appearance';

function storedMode(): ResolvedAppearance {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
        return 'dark';
    }
}

/**
 * Light/dark for the public pages (landing and sign-in). They start dark and
 * keep their own choice, so the app's Appearance setting is never changed;
 * leaving these pages hands the page back to that setting.
 */
export function usePublicAppearance() {
    const [mode, setMode] = useState<ResolvedAppearance>(storedMode);

    useLayoutEffect(() => {
        setAppearanceOverride(mode);

        return () => setAppearanceOverride(null);
    }, [mode]);

    const toggle = () => {
        const next: ResolvedAppearance = mode === 'dark' ? 'light' : 'dark';

        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage blocked: the cookie still carries the choice.
        }

        document.cookie = `${STORAGE_KEY}=${next};path=/;max-age=31536000;SameSite=Lax`;

        const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;

        // Cross-fade the switch where the browser supports view transitions.
        if ('startViewTransition' in document && !reduceMotion) {
            document.startViewTransition(() => flushSync(() => setMode(next)));
        } else {
            setMode(next);
        }
    };

    return { mode, toggle };
}
