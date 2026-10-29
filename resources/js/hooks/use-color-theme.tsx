import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_COLOR_THEME, themes } from '@/lib/themes';
import type { ColorTheme } from '@/lib/themes';

/**
 * The colour theme (palette, corners, font), separate from light/dark mode in
 * use-appearance.tsx. Saved per browser; the inline script in app.blade.php
 * adds the class before first paint so a theme never flashes Fiori first.
 */
const STORAGE_KEY = 'color-theme';

const listeners = new Set<() => void>();
let currentTheme: ColorTheme = DEFAULT_COLOR_THEME;

const isColorTheme = (value: string | null): value is ColorTheme =>
    themes.some((theme) => theme.value === value);

const getStoredTheme = (): ColorTheme => {
    if (typeof window === 'undefined') {
        return DEFAULT_COLOR_THEME;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        return isColorTheme(stored) ? stored : DEFAULT_COLOR_THEME;
    } catch {
        return DEFAULT_COLOR_THEME;
    }
};

const applyTheme = (value: ColorTheme): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const root = document.documentElement;

    themes.forEach((theme) => {
        if (theme.className) {
            root.classList.toggle(theme.className, theme.value === value);
        }
    });
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

export function initializeColorTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    currentTheme = getStoredTheme();
    applyTheme(currentTheme);
}

export function useColorTheme() {
    const colorTheme: ColorTheme = useSyncExternalStore(
        subscribe,
        () => currentTheme,
        () => DEFAULT_COLOR_THEME,
    );

    const setColorTheme = useCallback((value: ColorTheme): void => {
        currentTheme = value;

        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch {
            // Storage blocked (private mode): the theme still applies for this visit.
        }

        applyTheme(value);
        notify();
    }, []);

    return { colorTheme, setColorTheme } as const;
}
