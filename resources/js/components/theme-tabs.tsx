import { Check } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { ThemePreview } from '@/components/theme-preview';
import { useColorTheme } from '@/hooks/use-color-theme';
import { themes } from '@/lib/themes';
import { cn } from '@/lib/utils';

/** Colour theme picker: SAP Fiori, Vercel, Notion. Each preview shows light and dark. */
export default function ThemeTabs({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { colorTheme, setColorTheme } = useColorTheme();

    return (
        <div
            role="radiogroup"
            aria-label="Colour theme"
            className={cn('grid gap-4 sm:grid-cols-3', className)}
            {...props}
        >
            {themes.map((theme) => {
                const isActive = colorTheme === theme.value;

                return (
                    <button
                        key={theme.value}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        onClick={() => setColorTheme(theme.value)}
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

                        <span className="pr-6 text-sm font-semibold">
                            {theme.label}
                        </span>
                        <span className="mt-0.5 text-xs text-muted-foreground">
                            {theme.description}
                        </span>

                        <ThemePreview
                            panes={[theme.light, theme.dark]}
                            buttonRadius={theme.buttonRadius}
                        />
                    </button>
                );
            })}
        </div>
    );
}
