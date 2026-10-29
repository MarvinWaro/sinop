import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Action colours carried over from the old CIMS screens: red for add and
 * delete, amber for edit, green for the stock card, grey for the ledger card.
 */
export type ActionTone = 'red' | 'amber' | 'green' | 'gray' | 'blue';

const iconTones: Record<ActionTone, string> = {
    red: 'text-[#ce201f] hover:bg-[#ce201f]/10 hover:text-[#ce201f] dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-400',
    amber: 'text-amber-500 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300',
    green: 'text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300',
    gray: 'text-gray-600 hover:bg-gray-500/10 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100',
    blue: 'text-primary hover:bg-primary/10 hover:text-primary',
};

/** Filled button colours for page-level actions in the same family. */
export const solidTones: Record<ActionTone, string> = {
    red: 'bg-[#ce201f] text-white hover:bg-[#a01b1a] focus-visible:ring-[#ce201f]/30',
    amber: 'bg-amber-500 text-white hover:bg-amber-600 focus-visible:ring-amber-500/30',
    green: 'bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-500/30',
    gray: 'bg-gray-600 text-white hover:bg-gray-700 focus-visible:ring-gray-500/30 dark:bg-gray-600 dark:hover:bg-gray-500',
    blue: 'bg-primary text-primary-foreground hover:bg-primary/90',
};

type Props = {
    /** Shown in the tooltip and read by screen readers. */
    label: string;
    tone: ActionTone;
    children: ReactNode;
    className?: string;
} & (
    | { onClick: () => void; href?: never }
    | { href: NonNullable<InertiaLinkProps['href']>; onClick?: never }
);

/** Coloured icon-only row action with a tooltip. */
export function IconAction({
    label,
    tone,
    children,
    className,
    ...action
}: Props) {
    const classes = cn('size-8', iconTones[tone], className);

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {action.href !== undefined ? (
                    <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className={classes}
                    >
                        <Link href={action.href} aria-label={label}>
                            {children}
                        </Link>
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className={classes}
                        onClick={action.onClick}
                        aria-label={label}
                    >
                        {children}
                    </Button>
                )}
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}
