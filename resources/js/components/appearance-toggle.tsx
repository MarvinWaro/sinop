import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

/** Shows its first child in light mode and its second in dark mode. */
function ByMode({ light, dark }: { light: string; dark: string }) {
    return (
        <>
            <span className="dark:hidden">{light}</span>
            <span className="hidden dark:inline">{dark}</span>
        </>
    );
}

/**
 * The sun/moon button. What it shows follows the `dark` class on <html>
 * (set before paint), not React state, so the server-rendered HTML and the
 * browser always agree (no hydration mismatch with SSR).
 */
export function AppearanceToggleButton({
    onToggle,
    className,
}: {
    onToggle: () => void;
    className?: string;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('size-9', className)}
                    onClick={onToggle}
                >
                    <Moon className="size-5 dark:hidden" />
                    <Sun className="hidden size-5 dark:block" />
                    <span className="sr-only">
                        <ByMode
                            light="Switch to dark mode"
                            dark="Switch to light mode"
                        />
                    </span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <ByMode
                    light="Switch to dark mode"
                    dark="Switch to light mode"
                />
            </TooltipContent>
        </Tooltip>
    );
}

/**
 * One-click light/dark switch for the page header. It flips whatever is
 * showing now (including "system"); Settings › Appearance still offers
 * System to follow the device again.
 */
export function AppearanceToggle({ className }: { className?: string }) {
    const { updateAppearance } = useAppearance();

    return (
        <AppearanceToggleButton
            onToggle={() =>
                updateAppearance(
                    document.documentElement.classList.contains('dark')
                        ? 'light'
                        : 'dark',
                )
            }
            className={className}
        />
    );
}
