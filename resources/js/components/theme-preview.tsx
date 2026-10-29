import type { ThemePreviewColors } from '@/lib/themes';
import { cn } from '@/lib/utils';

/** Miniature page (header, two lines, a button) in one theme's palette. */
function PreviewPane({
    colors,
    buttonRadius,
    className,
}: {
    colors: ThemePreviewColors;
    buttonRadius: string;
    className?: string;
}) {
    return (
        <span className={cn('flex flex-1 flex-col', colors.page, className)}>
            <span
                className={cn(
                    'flex items-center gap-1.5 border-b px-2 py-1.5',
                    colors.header,
                )}
            >
                <span className={cn('h-1.5 w-6 rounded-sm', colors.line)} />
                <span className={cn('h-1.5 w-8 rounded-sm', colors.line)} />
            </span>
            <span className="flex flex-1 flex-col gap-1.5 p-2">
                <span className={cn('h-2 w-3/4 rounded-sm', colors.line)} />
                <span className={cn('h-2 w-full rounded-sm', colors.line)} />
                <span
                    className={cn(
                        'mt-auto h-2.5 w-8',
                        buttonRadius,
                        colors.primary,
                    )}
                />
            </span>
        </span>
    );
}

/** One or more panes side by side (e.g. light and dark halves). */
export function ThemePreview({
    panes,
    buttonRadius,
}: {
    panes: ThemePreviewColors[];
    buttonRadius: string;
}) {
    return (
        <span className="mt-3 flex h-20 overflow-hidden rounded-md border">
            {panes.map((colors, index) => (
                <PreviewPane
                    key={index}
                    colors={colors}
                    buttonRadius={buttonRadius}
                    className={index > 0 ? 'border-l' : undefined}
                />
            ))}
        </span>
    );
}
