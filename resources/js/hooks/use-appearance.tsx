import { useSyncExternalStore } from 'react';

export type ResolvedAppearance = 'light' | 'dark';
export type Appearance = ResolvedAppearance | 'system';

export type UseAppearanceReturn = {
    readonly appearance: Appearance;
    readonly resolvedAppearance: ResolvedAppearance;
    readonly updateAppearance: (mode: Appearance) => void;
};

// Dark until the user picks a mode (Settings › Appearance or the header
// switch). Keep in step with HandleAppearance's server-side default.
const DEFAULT_APPEARANCE: Appearance = 'dark';
// Set when the user picks a mode. 'system' used to be stored automatically,
// so a stored 'system' only counts once it has been chosen.
const CHOSEN_KEY = 'appearance_chosen';

const listeners = new Set<() => void>();
let currentAppearance: Appearance = DEFAULT_APPEARANCE;
// Forced light/dark while a page with its own switch is shown (see
// setAppearanceOverride); null means the user's setting applies.
let override: ResolvedAppearance | null = null;

const prefersDark = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getStoredAppearance = (): Appearance => {
    if (typeof window === 'undefined') {
        return DEFAULT_APPEARANCE;
    }

    const stored = localStorage.getItem('appearance');

    if (stored === 'light' || stored === 'dark') {
        return stored;
    }

    if (stored === 'system' && localStorage.getItem(CHOSEN_KEY)) {
        return 'system';
    }

    return DEFAULT_APPEARANCE;
};

const isDarkMode = (appearance: Appearance): boolean => {
    return appearance === 'dark' || (appearance === 'system' && prefersDark());
};

const applyTheme = (appearance: Appearance): void => {
    if (typeof document === 'undefined') {
        return;
    }

    const isDark = override ? override === 'dark' : isDarkMode(appearance);

    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const mediaQuery = (): MediaQueryList | null => {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.matchMedia('(prefers-color-scheme: dark)');
};

const handleSystemThemeChange = (): void => applyTheme(currentAppearance);

export function initializeTheme(): void {
    if (typeof window === 'undefined') {
        return;
    }

    // Public pages arrive with their mode already chosen by the server
    // (HandleAppearance), so the first paint doesn't flash the other mode.
    const pageMode = document.documentElement.dataset.appearanceOverride;
    override = pageMode === 'dark' || pageMode === 'light' ? pageMode : null;

    currentAppearance = getStoredAppearance();

    // Keep storage and the cookie (the server's first paint) in step.
    localStorage.setItem('appearance', currentAppearance);
    setCookie('appearance', currentAppearance);

    applyTheme(currentAppearance);

    // Set up system theme change listener
    mediaQuery()?.addEventListener('change', handleSystemThemeChange);
}

/**
 * Force light or dark while a page with its own switch is shown (landing and
 * sign-in pages, see use-public-appearance); null hands control back to the
 * user's appearance setting.
 */
export function setAppearanceOverride(mode: ResolvedAppearance | null): void {
    override = mode;
    applyTheme(currentAppearance);
    notify();
}

export function useAppearance(): UseAppearanceReturn {
    // The mode in effect: a page override wins (so toasts match the page).
    const appearance: Appearance = useSyncExternalStore(
        subscribe,
        () => override ?? currentAppearance,
        () => 'system',
    );

    const resolvedAppearance: ResolvedAppearance = isDarkMode(appearance)
        ? 'dark'
        : 'light';

    const updateAppearance = (mode: Appearance): void => {
        currentAppearance = mode;

        // Store in localStorage for client-side persistence...
        localStorage.setItem('appearance', mode);
        localStorage.setItem(CHOSEN_KEY, '1');

        // Store in cookie for SSR...
        setCookie('appearance', mode);

        applyTheme(mode);
        notify();
    };

    return { appearance, resolvedAppearance, updateAppearance } as const;
}
