import { Minus, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { memo } from 'react';
import { StockTag, SupplyIcon } from '@/components/staff/supply-visual';
import type { SupplyVisual } from '@/components/staff/supply-visual';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

/** One supply and what's left to request (StaffDashboardController). */
export type RequestableSupply = {
    supply_id: number;
    name: string;
    description: string | null;
    stock_no: string | null;
    unit: string | null;
    category: string | null;
    reorder_point: number;
    available: number;
};

export type SupplyOption = RequestableSupply & { visual: SupplyVisual };

export type CartItem = {
    supply_id: number;
    name: string;
    description: string | null;
    unit: string;
    quantity: number;
    max: number;
};

/** "Liquid, 500ml · BOTTLE", skipping what's missing. */
export const supplyMeta = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(' · ');

export function QuantityStepper({
    value,
    max,
    onChange,
    label,
    disabled = false,
}: {
    value: number;
    max: number;
    onChange: (value: number) => void;
    /** What the quantity is of, for screen readers. */
    label: string;
    disabled?: boolean;
}) {
    const clamp = (next: number) =>
        Math.max(0, Math.min(max, Number.isFinite(next) ? next : 0));

    return (
        <div className="flex h-8 shrink-0 items-center rounded-md border bg-background">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-r-none"
                onClick={() => onChange(clamp(value - 1))}
                disabled={disabled || value <= 0}
                aria-label={`One less ${label}`}
            >
                <Minus />
            </Button>
            <input
                type="number"
                inputMode="numeric"
                min={0}
                max={max}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
                onFocus={(e) => e.target.select()}
                className="h-full w-12 [appearance:textfield] border-x bg-transparent text-center text-sm tabular-nums outline-none focus-visible:bg-muted/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label={`Quantity of ${label}`}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-l-none"
                onClick={() => onChange(clamp(value + 1))}
                disabled={disabled || value >= max}
                aria-label={`One more ${label}`}
            >
                <Plus />
            </Button>
        </div>
    );
}

/**
 * One supply in the catalog. Not in the request yet: an Add button (adds
 * one). In the request: its quantity, changed right here (0 removes it).
 * Re-renders only when its own values change.
 */
export const CatalogRow = memo(function CatalogRow({
    supply,
    inRequest,
    onQuantity,
}: {
    supply: SupplyOption;
    inRequest: number;
    onQuantity: (supply: RequestableSupply, quantity: number) => void;
}) {
    const out = supply.available <= 0;

    return (
        <li
            className={cn(
                'flex items-center gap-3 px-3 py-2.5 sm:px-4',
                inRequest > 0 && 'bg-primary/[0.04]',
            )}
        >
            <SupplyIcon
                visual={supply.visual}
                className={cn('size-9', out && 'opacity-50')}
            />
            <div className="min-w-0 flex-1">
                <p
                    className={cn(
                        'truncate text-sm font-medium',
                        out && 'text-muted-foreground',
                    )}
                    title={supply.name}
                >
                    {supply.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                    {supplyMeta(
                        supply.stock_no ? `No. ${supply.stock_no}` : null,
                        supply.description,
                        supply.unit,
                    )}
                </p>
                <div className="mt-1 sm:hidden">
                    <StockTag
                        available={supply.available}
                        remaining={Math.max(0, supply.available - inRequest)}
                        reorderPoint={supply.reorder_point}
                    />
                </div>
            </div>
            <div className="hidden w-36 shrink-0 sm:block">
                <StockTag
                    available={supply.available}
                    remaining={Math.max(0, supply.available - inRequest)}
                    reorderPoint={supply.reorder_point}
                />
            </div>
            <div className="flex w-[7.5rem] shrink-0 justify-end">
                {inRequest > 0 ? (
                    <QuantityStepper
                        value={inRequest}
                        max={supply.available}
                        label={supply.name}
                        onChange={(value) => onQuantity(supply, value)}
                    />
                ) : (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={out}
                        onClick={() => onQuantity(supply, 1)}
                        aria-label={`Add ${supply.name}`}
                    >
                        <Plus />
                        Add
                    </Button>
                )}
            </div>
        </li>
    );
});

/**
 * One line of the request. When the server turned it down, it says what's
 * left now (or the server's message until that's known) and caps the
 * quantity.
 */
export function RequestLine({
    item,
    visual,
    asked,
    left,
    serverMessage,
    onQuantity,
}: {
    item: CartItem;
    visual: SupplyVisual;
    asked: number | undefined;
    left: number | null;
    serverMessage: string | undefined;
    onQuantity: (value: number) => void;
}) {
    const turnedDown = asked !== undefined;

    return (
        <li className="grid gap-2 px-4 py-3">
            <div className="flex items-start gap-3">
                <SupplyIcon visual={visual} className="size-8" />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {supplyMeta(item.description, item.unit)}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="-mt-1 -mr-2 size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onQuantity(0)}
                    aria-label={`Remove ${item.name}`}
                >
                    <Trash2 />
                </Button>
            </div>
            <div className="flex items-center justify-between gap-2 pl-11">
                {turnedDown ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <TriangleAlert className="size-3.5 shrink-0" />
                        {left === null
                            ? serverMessage
                            : left === 0
                              ? 'None left'
                              : `Only ${formatNumber(left)} left (you asked for ${formatNumber(asked)})`}
                    </p>
                ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        Up to {formatNumber(item.max)}
                    </span>
                )}
                <QuantityStepper
                    value={item.quantity}
                    max={turnedDown && left !== null ? left : item.max}
                    label={item.name}
                    onChange={onQuantity}
                />
            </div>
        </li>
    );
}

/** Shown when the server turned items down because others asked first. */
export function StockConflictNotice({
    checking,
    onApplyWhatsLeft,
}: {
    checking: boolean;
    onApplyWhatsLeft: () => void;
}) {
    return (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
            <TriangleAlert />
            <AlertTitle>Someone requested some of these items first</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-200/90">
                <p>
                    Supplies go to requests in the order they're submitted.
                    While you were filling this in, other requests took some of
                    the stock.
                </p>
                <Button
                    type="button"
                    size="sm"
                    onClick={onApplyWhatsLeft}
                    disabled={checking}
                    className="mt-1"
                >
                    {checking ? (
                        <>
                            <Spinner />
                            Checking what's left…
                        </>
                    ) : (
                        "Update to what's left"
                    )}
                </Button>
            </AlertDescription>
        </Alert>
    );
}
