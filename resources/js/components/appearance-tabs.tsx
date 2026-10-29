import type { LucideIcon } from 'lucide-react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { ThemePreview } from '@/components/theme-preview';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { useColorTheme } from '@/hooks/use-color-theme';
import { themeDefinition } from '@/lib/themes';
import { cn } from '@/lib/utils';

const options: {
    value: Appearance;
    label: string;
    description: string;
    icon: LucideIcon;
    panes: ('light' | 'dark')[];
}[] = [
    {
        value: 'light',
        label: 'Light',
        description: 'Clean and bright interface for daytime use.',
        icon: Sun,
        panes: ['light'],
    },
    {
        value: 'dark',
        label: 'Dark',
        description: 'Easier on the eyes in low-light environments.',
        icon: Moon,
        panes: ['dark'],
    },
    {
        value: 'system',
        label: 'System',
        description: 'Automatically matches your device settings.',
        icon: Monitor,
        panes: ['light', 'dark'],
    },
];

export default function AppearanceTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();
    // Previews show the active colour theme in each mode.
    const { colorTheme } = useColorTheme();
    const theme = themeDefinition(colorTheme);

    return (
        <div
            role="radiogroup"
            aria-label="Appearance"
            className={cn('grid gap-4 sm:grid-cols-3', className)}
            {...props}
        >
            {options.map(({ value, label, description, icon: Icon, panes }) => {
                const isActive = appearance === value;

                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => updateAppearance(value)}
                        className={cn(
                            'relative flex flex-col rounded-xl border-2 bg-card p-4 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                            isActive
                                ? 'border-primary'
                                : 'border-border hover:border-input',
                        )}
                    >
                        {isActive && (
                            <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="size-3" />
                            </span>
                        )}

                        <span
                            className={cn(
                                'mb-3 flex size-10 items-center justify-center rounded-lg',
                                isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'bg-muted text-muted-foreground',
                            )}
                        >
                            <Icon className="size-5" />
                        </span>

                        <span className="text-sm font-semibold">{label}</span>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                            {description}
                        </span>

                        <ThemePreview
                            panes={panes.map((mode) => theme[mode])}
                            buttonRadius={theme.buttonRadius}
                        />
                    </button>
                );
            })}
        </div>
    );
}
