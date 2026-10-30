import { useForm } from '@inertiajs/react';
import {
    Check,
    Minus,
    Plus,
    ShoppingCart,
    Trash2,
    TriangleAlert,
} from 'lucide-react';
import { Fragment, memo, useCallback, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import InputError from '@/components/input-error';
import { SearchInput } from '@/components/search-input';
import { SignatureChoice } from '@/components/signature-choice';
import {
    StockTag,
    SupplyIcon,
    categoryLabels,
    supplyVisual,
} from '@/components/staff/supply-visual';
import type {
    SupplyCategoryKey,
    SupplyVisual,
} from '@/components/staff/supply-visual';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { officeOfDivision } from '@/lib/ris';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { store as storeRis } from '@/routes/ris';
import type { Department, SignatureType } from '@/types';

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

type SupplyOption = RequestableSupply & { visual: SupplyVisual };

/** Cards rendered at first, and added each time the list end comes near. */
const PAGE_SIZE = 24;

const categoryOrder = Object.keys(categoryLabels) as SupplyCategoryKey[];

type CartItem = {
    supply_id: number;
    name: string;
    description: string | null;
    unit: string;
    quantity: number;
    max: number;
};

/**
 * Items the server turned down because others requested them first: what
 * was asked for and the server's message, per supply, plus the supply list
 * the dialog had then (a newer one means "what's left" is known).
 */
type StockConflict = {
    asked: Map<number, number>;
    messages: Map<number, string>;
    supplies: RequestableSupply[];
};

type RequestForm = {
    entity_name: string;
    division: string;
    office: string;
    fund_cluster: string;
    responsibility_center_code: string;
    purpose: string;
    supplies: { supply_id: number; quantity: number }[];
    signature_type: SignatureType;
};

export function RequestSupplyDialog({
    open,
    onOpenChange,
    supplies,
    departments,
    defaultDivision,
    onStockChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    supplies: RequestableSupply[];
    departments: Pick<Department, 'id' | 'name'>[];
    defaultDivision: number | null;
    /** Ask for a fresh supply list (after a conflict or a new request). */
    onStockChange?: () => void;
}) {
    const [step, setStep] = useState<'items' | 'confirm'>('items');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<SupplyCategoryKey | ''>('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [showCart, setShowCart] = useState(false);
    const [conflict, setConflict] = useState<StockConflict | null>(null);
    const scrollArea = useRef<HTMLDivElement>(null);

    const form = useForm<RequestForm>({
        entity_name: 'CHEDRO 12',
        division: defaultDivision ? String(defaultDivision) : '',
        office: '',
        fund_cluster: '',
        responsibility_center_code: '',
        purpose: '',
        supplies: [],
        signature_type: 'sgd',
    });

    // Office follows the division ("Scholarship Division - UniFAST BARMM" →
    // "UniFAST BARMM") until the person types their own.
    const [officeTyped, setOfficeTyped] = useState(false);
    const office = officeTyped
        ? form.data.office
        : officeOfDivision(
              departments.find(
                  (department) => String(department.id) === form.data.division,
              )?.name,
          );

    // One card per supply (the server already picked each supply's largest
    // stock row), with its icon worked out once.
    const products = useMemo<SupplyOption[]>(
        () =>
            supplies.map((supply) => ({
                ...supply,
                visual: supplyVisual(supply.name, supply.category),
            })),
        [supplies],
    );

    const categoryCounts = useMemo(() => {
        const counts = new Map<SupplyCategoryKey, number>();

        products.forEach(({ visual }) =>
            counts.set(visual.category, (counts.get(visual.category) ?? 0) + 1),
        );

        return categoryOrder.flatMap((key) => {
            const count = counts.get(key);

            return count ? [{ key, count }] : [];
        });
    }, [products]);

    const term = search.trim().toLowerCase();
    const visibleProducts = useMemo(
        () =>
            products.filter(
                (product) =>
                    (!category || product.visual.category === category) &&
                    (!term ||
                        `${product.name} ${product.description ?? ''} ${product.stock_no ?? ''}`
                            .toLowerCase()
                            .includes(term)),
            ),
        [products, category, term],
    );
    const shownProducts = visibleProducts.slice(0, limit);
    const hasMore = visibleProducts.length > limit;

    // A new search or category starts from the top of the list again.
    const changeSearch = (value: string) => {
        setSearch(value);
        setLimit(PAGE_SIZE);
    };

    const changeCategory = (value: SupplyCategoryKey | '') => {
        setCategory(value);
        setLimit(PAGE_SIZE);
    };

    // Renders the next cards when the end of the list scrolls near. The
    // marker is keyed by `limit`, so it's observed afresh after each batch
    // (in case it's still in view on a tall screen).
    const observeListEnd = useCallback((element: HTMLDivElement | null) => {
        if (!element) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) {
                    setLimit((current) => current + PAGE_SIZE);
                }
            },
            { root: scrollArea.current, rootMargin: '0px 0px 400px 0px' },
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const cartQuantities = useMemo(
        () => new Map(cart.map((item) => [item.supply_id, item.quantity])),
        [cart],
    );

    const productById = useMemo(
        () => new Map(products.map((product) => [product.supply_id, product])),
        [products],
    );

    // A newer supply list than the one at the failed submit says what's left.
    const refreshed = conflict !== null && conflict.supplies !== supplies;
    const leftNow = (supplyId: number): number | null =>
        refreshed ? (productById.get(supplyId)?.available ?? 0) : null;

    const applyWhatsLeft = () => {
        if (!conflict || !refreshed) {
            return;
        }

        setCart((current) =>
            current.flatMap((item) => {
                if (!conflict.asked.has(item.supply_id)) {
                    return [item];
                }

                const left = productById.get(item.supply_id)?.available ?? 0;

                return left > 0
                    ? [
                          {
                              ...item,
                              quantity: Math.min(item.quantity, left),
                              max: left,
                          },
                      ]
                    : [];
            }),
        );
        setConflict(null);
        form.clearErrors();
    };

    const setQuantity = useCallback((supplyId: number, value: number) => {
        setQuantities((current) => ({ ...current, [supplyId]: value }));
    }, []);

    const addToCart = useCallback(
        (supply: RequestableSupply, quantity: number) => {
            if (quantity <= 0) {
                return;
            }

            const max = supply.available;

            setCart((current) => {
                const existing = current.find(
                    (item) => item.supply_id === supply.supply_id,
                );

                if (existing) {
                    return current.map((item) =>
                        item.supply_id === supply.supply_id
                            ? {
                                  ...item,
                                  quantity: Math.min(
                                      max,
                                      item.quantity + quantity,
                                  ),
                              }
                            : item,
                    );
                }

                return [
                    ...current,
                    {
                        supply_id: supply.supply_id,
                        name: supply.name,
                        description: supply.description,
                        unit: supply.unit ?? '',
                        quantity: Math.min(max, quantity),
                        max,
                    },
                ];
            });
            setQuantities((current) => ({
                ...current,
                [supply.supply_id]: 0,
            }));
        },
        [],
    );

    const addAll = () => {
        products.forEach((product) => {
            const quantity = quantities[product.supply_id] ?? 0;

            if (quantity > 0) {
                addToCart(product, quantity);
            }
        });
    };

    const updateCartQuantity = (supplyId: number, quantity: number) => {
        setCart((current) =>
            current
                .map((item) =>
                    item.supply_id === supplyId
                        ? {
                              ...item,
                              quantity: Math.max(
                                  0,
                                  Math.min(item.max, quantity),
                              ),
                          }
                        : item,
                )
                .filter((item) => item.quantity > 0),
        );
    };

    const reset = () => {
        form.reset();
        form.clearErrors();
        setOfficeTyped(false);
        setCart([]);
        setQuantities({});
        setSearch('');
        setCategory('');
        setLimit(PAGE_SIZE);
        setStep('items');
        setShowCart(false);
        setConflict(null);
    };

    const close = (value: boolean) => {
        onOpenChange(value);

        if (!value) {
            reset();
        }
    };

    const goToConfirm = () => {
        if (cart.length === 0) {
            form.setError('supplies', 'Add at least one item to your request.');

            return;
        }

        form.clearErrors();
        setConflict(null);
        setStep('confirm');
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();

        const submitted = cart;
        const suppliesThen = supplies;

        form.transform((data) => ({
            ...data,
            office,
            supplies: submitted.map((item) => ({
                supply_id: item.supply_id,
                quantity: item.quantity,
            })),
        }));

        form.post(storeRis.url(), {
            preserveScroll: true,
            onSuccess: () => {
                close(false);
                // This request now holds stock: count it next time.
                onStockChange?.();
            },
            onError: (errors) => {
                // "supplies.2.quantity" is about the third item sent.
                const asked = new Map<number, number>();
                const messages = new Map<number, string>();

                Object.entries(errors).forEach(([key, message]) => {
                    const index = /^supplies\.(\d+)\./.exec(key)?.[1];
                    const item =
                        index === undefined ? undefined : submitted[+index];

                    if (item) {
                        asked.set(item.supply_id, item.quantity);
                        messages.set(item.supply_id, message);
                    }
                });

                if (asked.size > 0) {
                    setConflict({ asked, messages, supplies: suppliesThen });
                    setShowCart(true);
                    onStockChange?.();
                }

                setStep('items');
            },
        });
    };

    const stockErrors = Object.entries(
        form.errors as Record<string, string | undefined>,
    )
        .filter(([key]) => key.startsWith('supplies.'))
        .map(([, message]) => message)
        .filter(Boolean);

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>
                        {step === 'items'
                            ? 'Request supplies'
                            : 'Review your request'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'items'
                            ? 'Fill in the requisition details, then add the items you need.'
                            : 'Check the details, choose how to sign, then submit.'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'items' ? (
                    <div
                        ref={scrollArea}
                        className="-mx-6 flex-1 space-y-5 overflow-y-auto px-6"
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                label="Entity name"
                                htmlFor="entity_name"
                                error={form.errors.entity_name}
                                required
                            >
                                <Input
                                    id="entity_name"
                                    value={form.data.entity_name}
                                    onChange={(e) =>
                                        form.setData(
                                            'entity_name',
                                            e.target.value,
                                        )
                                    }
                                    required
                                />
                            </FormField>
                            <FormField
                                label="Division"
                                htmlFor="division"
                                error={form.errors.division}
                                required
                            >
                                <FormSelect
                                    id="division"
                                    value={form.data.division}
                                    onValueChange={(value) => {
                                        form.setData('division', value);

                                        // A cleared office follows the division again.
                                        if (!form.data.office.trim()) {
                                            setOfficeTyped(false);
                                        }
                                    }}
                                    required
                                    placeholder="Select division"
                                    options={departments.map((department) => ({
                                        value: department.id,
                                        label: department.name,
                                    }))}
                                />
                            </FormField>
                            <FormField
                                label="Office"
                                htmlFor="office"
                                error={form.errors.office}
                            >
                                <Input
                                    id="office"
                                    value={office}
                                    onChange={(e) => {
                                        setOfficeTyped(true);
                                        form.setData('office', e.target.value);
                                    }}
                                />
                            </FormField>
                            <FormField
                                label="Responsibility center code"
                                htmlFor="responsibility_center_code"
                                error={form.errors.responsibility_center_code}
                            >
                                <Input
                                    id="responsibility_center_code"
                                    value={form.data.responsibility_center_code}
                                    onChange={(e) =>
                                        form.setData(
                                            'responsibility_center_code',
                                            e.target.value,
                                        )
                                    }
                                />
                            </FormField>
                            <FormField
                                label="Purpose"
                                htmlFor="purpose"
                                error={form.errors.purpose}
                                className="md:col-span-2"
                            >
                                <Textarea
                                    id="purpose"
                                    rows={2}
                                    value={form.data.purpose}
                                    onChange={(e) =>
                                        form.setData('purpose', e.target.value)
                                    }
                                    placeholder="Optional"
                                />
                            </FormField>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="font-medium">
                                    {showCart
                                        ? 'Selected items'
                                        : 'Select items to request'}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {!showCart && (
                                        <>
                                            <SearchInput
                                                placeholder="Search items..."
                                                aria-label="Search items"
                                                value={search}
                                                onValueChange={changeSearch}
                                                className="w-full sm:w-56"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={addAll}
                                            >
                                                Add all to request
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        type="button"
                                        variant={
                                            showCart ? 'outline' : 'secondary'
                                        }
                                        onClick={() =>
                                            setShowCart((value) => !value)
                                        }
                                        disabled={
                                            cart.length === 0 && !showCart
                                        }
                                    >
                                        <ShoppingCart />
                                        {showCart
                                            ? 'Back to items'
                                            : `View selected (${cart.length})`}
                                    </Button>
                                </div>
                            </div>

                            {conflict ? (
                                <StockConflictNotice
                                    checking={!refreshed}
                                    onApplyWhatsLeft={applyWhatsLeft}
                                />
                            ) : (
                                <InputError message={form.errors.supplies} />
                            )}
                            {!conflict && stockErrors.length > 0 && (
                                <ul className="list-disc space-y-1 rounded-md border border-destructive/40 bg-destructive/5 py-2 pr-3 pl-7 text-sm text-destructive">
                                    {stockErrors.map((message) => (
                                        <li key={message}>{message}</li>
                                    ))}
                                </ul>
                            )}

                            {showCart ? (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item</TableHead>
                                                <TableHead className="w-40 text-center">
                                                    Quantity
                                                </TableHead>
                                                <TableHead className="w-12" />
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {cart.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={3}>
                                                        <EmptyState title="No items selected" />
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                cart.map((item) => (
                                                    <CartRow
                                                        key={item.supply_id}
                                                        item={item}
                                                        asked={conflict?.asked.get(
                                                            item.supply_id,
                                                        )}
                                                        left={leftNow(
                                                            item.supply_id,
                                                        )}
                                                        serverMessage={conflict?.messages.get(
                                                            item.supply_id,
                                                        )}
                                                        onQuantity={(value) =>
                                                            updateCartQuantity(
                                                                item.supply_id,
                                                                value,
                                                            )
                                                        }
                                                    />
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <>
                                    {categoryCounts.length > 1 && (
                                        <div
                                            role="group"
                                            aria-label="Filter by category"
                                            className="flex flex-wrap gap-2"
                                        >
                                            <CategoryChip
                                                label="All"
                                                count={products.length}
                                                active={category === ''}
                                                onClick={() =>
                                                    changeCategory('')
                                                }
                                            />
                                            {categoryCounts.map(
                                                ({ key, count }) => (
                                                    <CategoryChip
                                                        key={key}
                                                        label={
                                                            categoryLabels[key]
                                                        }
                                                        count={count}
                                                        active={
                                                            category === key
                                                        }
                                                        onClick={() =>
                                                            changeCategory(key)
                                                        }
                                                    />
                                                ),
                                            )}
                                        </div>
                                    )}

                                    {visibleProducts.length === 0 ? (
                                        <EmptyState title="No items match your search" />
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {shownProducts.map((product) => (
                                                <SupplyCard
                                                    key={product.supply_id}
                                                    supply={product}
                                                    quantity={
                                                        quantities[
                                                            product.supply_id
                                                        ] ?? 0
                                                    }
                                                    inCart={
                                                        cartQuantities.get(
                                                            product.supply_id,
                                                        ) ?? 0
                                                    }
                                                    onQuantity={setQuantity}
                                                    onAdd={addToCart}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {hasMore && (
                                        <div
                                            key={limit}
                                            ref={observeListEnd}
                                            className="py-2 text-center text-xs text-muted-foreground"
                                        >
                                            Loading more items…
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <form
                        id="request-confirm"
                        onSubmit={submit}
                        className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6"
                    >
                        <dl className="grid gap-x-6 gap-y-3 rounded-md border p-4 text-sm sm:grid-cols-2">
                            <ReviewField
                                label="Entity name"
                                value={form.data.entity_name}
                            />
                            <ReviewField
                                label="Division"
                                value={
                                    departments.find(
                                        (department) =>
                                            String(department.id) ===
                                            form.data.division,
                                    )?.name
                                }
                            />
                            <ReviewField label="Office" value={office} />
                            <ReviewField
                                label="Responsibility center code"
                                value={form.data.responsibility_center_code}
                            />
                            <ReviewField
                                label="Purpose"
                                value={form.data.purpose}
                                className="sm:col-span-2"
                            />
                        </dl>

                        <div className="rounded-md border">
                            <div className="flex items-center justify-between border-b px-4 py-2.5 text-sm">
                                <span className="font-medium">
                                    Items ({cart.length})
                                </span>
                                <span className="text-muted-foreground tabular-nums">
                                    {formatNumber(
                                        cart.reduce(
                                            (sum, item) => sum + item.quantity,
                                            0,
                                        ),
                                    )}{' '}
                                    in total
                                </span>
                            </div>
                            <ul className="divide-y">
                                {cart.map((item) => (
                                    <li
                                        key={item.supply_id}
                                        className="flex items-center gap-3 px-4 py-2.5"
                                    >
                                        <SupplyIcon
                                            visual={
                                                productById.get(item.supply_id)
                                                    ?.visual ??
                                                supplyVisual(item.name, null)
                                            }
                                            className="size-9"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">
                                                {item.name}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {[item.description, item.unit]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                        </div>
                                        <span className="text-sm font-medium tabular-nums">
                                            {formatNumber(item.quantity)}{' '}
                                            <span className="font-normal text-muted-foreground">
                                                {item.unit}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <SignatureChoice
                            value={form.data.signature_type}
                            onChange={(value) =>
                                form.setData('signature_type', value)
                            }
                        />
                    </form>
                )}

                <DialogFooter className="border-t pt-4">
                    {/* Keyed so Continue and Submit are different buttons:
                        reusing one would turn the Continue click into a
                        submit as soon as the review step renders. */}
                    {step === 'items' ? (
                        <Fragment key="items">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => close(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="button" onClick={goToConfirm}>
                                Continue ({cart.length}{' '}
                                {cart.length === 1 ? 'item' : 'items'})
                            </Button>
                        </Fragment>
                    ) : (
                        <Fragment key="review">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep('items')}
                            >
                                Back
                            </Button>
                            <Button
                                type="submit"
                                form="request-confirm"
                                disabled={form.processing}
                            >
                                {form.processing && <Spinner />}
                                Submit request
                            </Button>
                        </Fragment>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ReviewField({
    label,
    value,
    className,
}: {
    label: string;
    value: string | null | undefined;
    className?: string;
}) {
    return (
        <div className={cn('min-w-0', className)}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value?.trim() || '—'}</dd>
        </div>
    );
}

/** Shown when the server turned items down because others asked first. */
function StockConflictNotice({
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
                    the stock. Here's what's left now.
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

/**
 * One selected item. When the server turned it down, it says what's left
 * now (or the server's message until that's known) and caps the quantity.
 */
function CartRow({
    item,
    asked,
    left,
    serverMessage,
    onQuantity,
}: {
    item: CartItem;
    asked: number | undefined;
    left: number | null;
    serverMessage: string | undefined;
    onQuantity: (value: number) => void;
}) {
    const turnedDown = asked !== undefined;

    return (
        <TableRow>
            <TableCell className="whitespace-normal">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                    {[item.description, item.unit].filter(Boolean).join(' · ')}
                </p>
                {turnedDown && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <TriangleAlert className="size-3.5 shrink-0" />
                        {left === null
                            ? serverMessage
                            : left === 0
                              ? 'None left — requested by others first'
                              : `Only ${formatNumber(left)} left now (you asked for ${formatNumber(asked)})`}
                    </p>
                )}
            </TableCell>
            <TableCell>
                <QuantityStepper
                    value={item.quantity}
                    max={turnedDown && left !== null ? left : item.max}
                    onChange={onQuantity}
                />
            </TableCell>
            <TableCell>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onQuantity(0)}
                    aria-label={`Remove ${item.name}`}
                >
                    <Trash2 />
                </Button>
            </TableCell>
        </TableRow>
    );
}

function CategoryChip({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            aria-pressed={active}
            onClick={onClick}
            className="rounded-full"
        >
            {label}
            <span className="tabular-nums opacity-70">{count}</span>
        </Button>
    );
}

/** One supply in the picker; re-renders only when its own values change. */
const SupplyCard = memo(function SupplyCard({
    supply,
    quantity,
    inCart,
    onQuantity,
    onAdd,
}: {
    supply: SupplyOption;
    quantity: number;
    inCart: number;
    onQuantity: (supplyId: number, value: number) => void;
    onAdd: (supply: RequestableSupply, quantity: number) => void;
}) {
    const remaining = Math.max(0, supply.available - inCart);

    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm',
                supply.available <= 0 && 'opacity-60',
            )}
        >
            <div className="flex items-start gap-3">
                <SupplyIcon visual={supply.visual} />
                <div className="min-w-0 flex-1 space-y-1.5">
                    <p
                        className="line-clamp-2 leading-tight font-medium"
                        title={supply.name}
                    >
                        {supply.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {[supply.description, supply.unit]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <StockTag
                            available={supply.available}
                            remaining={remaining}
                            reorderPoint={supply.reorder_point}
                        />
                        {inCart > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary tabular-nums">
                                <Check className="size-3" />
                                {inCart} in request
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="mt-auto flex items-center gap-2">
                <QuantityStepper
                    value={quantity}
                    max={remaining}
                    disabled={remaining <= 0}
                    onChange={(value) => onQuantity(supply.supply_id, value)}
                />
                <Button
                    type="button"
                    size="sm"
                    variant={quantity > 0 ? 'default' : 'outline'}
                    disabled={quantity <= 0}
                    onClick={() => onAdd(supply, quantity)}
                    className="ml-auto"
                >
                    <Plus />
                    Add
                </Button>
            </div>
        </div>
    );
});

function QuantityStepper({
    value,
    max,
    onChange,
    disabled = false,
}: {
    value: number;
    max: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}) {
    const clamp = (next: number) =>
        Math.max(0, Math.min(max, Number.isFinite(next) ? next : 0));

    return (
        <div className="flex items-center rounded-md border">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-r-none"
                onClick={() => onChange(clamp(value - 1))}
                disabled={disabled || value <= 0}
                aria-label="Decrease quantity"
            >
                <Minus />
            </Button>
            <input
                type="number"
                min={0}
                max={max}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(clamp(parseInt(e.target.value, 10)))}
                className="h-8 w-14 [appearance:textfield] border-x bg-transparent text-center text-sm outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Quantity"
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-l-none"
                onClick={() => onChange(clamp(value + 1))}
                disabled={disabled || value >= max}
                aria-label="Increase quantity"
            >
                <Plus />
            </Button>
        </div>
    );
}
