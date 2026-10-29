/**
 * Colour themes. Each one is a class on <html> that overrides the colour,
 * radius and font tokens in app.css, so components never need to know which
 * theme is active. SAP Fiori is app.css's own :root / .dark token set.
 *
 * Palettes come from the getdesign.md DESIGN.md files (Vercel = Geist,
 * Notion = warm paper + Notion blue). Neither file defines a dark palette, so
 * dark mode follows Vercel's Geist dark greys and Notion's app dark mode.
 */
export type ColorTheme = 'fiori' | 'vercel' | 'notion';

export const DEFAULT_COLOR_THEME: ColorTheme = 'fiori';

/** Swatch classes for one mode of a theme preview (the theme's own palette, not the active one). */
export type ThemePreviewColors = {
    page: string;
    header: string;
    line: string;
    primary: string;
};

export type ThemeDefinition = {
    value: ColorTheme;
    label: string;
    description: string;
    /** Class added to <html>; null for the default token set. */
    className: string | null;
    light: ThemePreviewColors;
    dark: ThemePreviewColors;
    buttonRadius: string;
};

export const themes: ThemeDefinition[] = [
    {
        value: 'fiori',
        label: 'SAP Fiori',
        description: 'Calm business blues on a light grey chrome. Inter.',
        className: null,
        light: {
            page: 'border-[#dfe3e8] bg-[#ffffff]',
            header: 'border-[#dfe3e8] bg-[#f5f6f7]',
            line: 'bg-[#dfe3e8]',
            primary: 'bg-[#0057d2]',
        },
        dark: {
            page: 'border-[#343e48] bg-[#12171c]',
            header: 'border-[#343e48] bg-[#1d232a]',
            line: 'bg-[#343e48]',
            primary: 'bg-[#6bc0ff]',
        },
        buttonRadius: 'rounded-[4px]',
    },
    {
        value: 'vercel',
        label: 'Vercel',
        description: 'Black-and-white precision, hairline borders. Geist.',
        className: 'theme-vercel',
        light: {
            page: 'border-[#ebebeb] bg-[#fafafa]',
            header: 'border-[#ebebeb] bg-[#ffffff]',
            line: 'bg-[#ebebeb]',
            primary: 'bg-[#171717]',
        },
        dark: {
            page: 'border-[#262626] bg-[#0a0a0a]',
            header: 'border-[#262626] bg-[#111111]',
            line: 'bg-[#262626]',
            primary: 'bg-[#ededed]',
        },
        buttonRadius: 'rounded-[3px]',
    },
    {
        value: 'notion',
        label: 'Notion',
        description: 'Warm paper canvas, soft surfaces, one confident blue.',
        className: 'theme-notion',
        light: {
            page: 'border-[#e6e6e6] bg-[#f6f5f4]',
            header: 'border-[#e6e6e6] bg-[#ffffff]',
            line: 'bg-[#e6e6e6]',
            primary: 'bg-[#0075de]',
        },
        dark: {
            page: 'border-[#2f2f2f] bg-[#191919]',
            header: 'border-[#2f2f2f] bg-[#202020]',
            line: 'bg-[#2f2f2f]',
            primary: 'bg-[#62aef0]',
        },
        buttonRadius: 'rounded-[4px]',
    },
];

export function themeDefinition(value: ColorTheme): ThemeDefinition {
    return themes.find((theme) => theme.value === value) ?? themes[0];
}
