import type { ReactNode } from 'react';

export default function Heading({
    title,
    description,
    variant = 'default',
    actions,
}: {
    title: string;
    description?: string;
    variant?: 'default' | 'small';
    /** Buttons shown on the right of the title, e.g. "Add user". */
    actions?: ReactNode;
}) {
    const header = (
        <header className={variant === 'small' ? '' : 'mb-8 space-y-0.5'}>
            <h2
                className={
                    variant === 'small'
                        ? 'mb-0.5 text-base font-medium'
                        : 'text-xl font-semibold tracking-tight'
                }
            >
                {title}
            </h2>
            {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
            )}
        </header>
    );

    if (!actions) {
        return header;
    }

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            {header}
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
    );
}
