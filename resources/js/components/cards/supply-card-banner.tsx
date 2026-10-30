import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Supply } from '@/types';

type Neighbour = { supply_id: number; item_name: string; stock_no: string };

export type SupplyCardNavigation = {
    previous: Neighbour | null;
    next: Neighbour | null;
    position: number;
    total: number;
};

/** Translucent controls that read on the band in every theme and mode. */
export const onBanner = {
    button: 'border border-band-foreground/25 bg-band-foreground/10 text-band-foreground shadow-none hover:bg-band-foreground/20 hover:text-band-foreground',
    solid: 'border-transparent bg-card text-card-foreground shadow-sm hover:bg-card/90',
    select: 'border-transparent bg-card text-card-foreground shadow-sm dark:bg-card dark:hover:bg-card',
};

/**
 * Coloured header for the Stock Card and Supply Ledger Card: the item, its
 * stock number, Prev / Next through the card list, then the period filters
 * and exports.
 */
export function SupplyCardBanner({
    eyebrow,
    supply,
    navigation,
    hrefFor,
    filters,
    actions,
}: {
    eyebrow: string;
    supply: Supply;
    navigation: SupplyCardNavigation;
    hrefFor: (supplyId: number) => NonNullable<InertiaLinkProps['href']>;
    filters: ReactNode;
    actions: ReactNode;
}) {
    return (
        <section className="overflow-hidden rounded-xl bg-band text-band-foreground ring-1 ring-band-foreground/10 ring-inset">
            <div className="flex flex-col gap-5 p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-1">
                        <p className="text-xs font-medium tracking-wide uppercase opacity-80">
                            {eyebrow}
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight break-words">
                            {supply.item_name}
                        </h1>
                        <p className="text-sm opacity-90">
                            Stock no. {supply.stock_no}
                            {supply.description && (
                                <span className="opacity-80">
                                    {' '}
                                    · {supply.description}
                                </span>
                            )}
                        </p>
                    </div>

                    <nav
                        aria-label="Browse items"
                        className="flex shrink-0 items-center gap-2"
                    >
                        <NeighbourButton
                            direction="previous"
                            neighbour={navigation.previous}
                            hrefFor={hrefFor}
                        />
                        <span className="min-w-24 text-center text-xs tabular-nums opacity-85">
                            Item {formatNumber(navigation.position)} of{' '}
                            {formatNumber(navigation.total)}
                        </span>
                        <NeighbourButton
                            direction="next"
                            neighbour={navigation.next}
                            hrefFor={hrefFor}
                        />
                    </nav>
                </div>

                <div className="flex flex-col gap-3 border-t border-band-foreground/15 pt-4 md:flex-row md:items-center md:justify-between">
                    {filters}
                    <div className="flex flex-wrap gap-2">{actions}</div>
                </div>
            </div>
        </section>
    );
}

function NeighbourButton({
    direction,
    neighbour,
    hrefFor,
}: {
    direction: 'previous' | 'next';
    neighbour: Neighbour | null;
    hrefFor: (supplyId: number) => NonNullable<InertiaLinkProps['href']>;
}) {
    const isPrevious = direction === 'previous';
    const label = isPrevious ? 'Previous' : 'Next';
    const content = (
        <>
            {isPrevious && <ChevronLeft />}
            {label}
            {!isPrevious && <ChevronRight />}
        </>
    );

    if (!neighbour) {
        return (
            <Button
                size="sm"
                disabled
                className={cn(onBanner.button, 'disabled:opacity-40')}
                aria-label={`No ${direction} item`}
            >
                {content}
            </Button>
        );
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button asChild size="sm" className={onBanner.button}>
                    <Link
                        href={hrefFor(neighbour.supply_id)}
                        preserveScroll
                        aria-label={`${label} item: ${neighbour.item_name}`}
                    >
                        {content}
                    </Link>
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {neighbour.item_name} · {neighbour.stock_no}
            </TooltipContent>
        </Tooltip>
    );
}
