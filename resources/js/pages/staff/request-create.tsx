import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Check, PackageOpen, SearchX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import InputError from '@/components/input-error';
import { PageContainer } from '@/components/page-header';
import { SearchInput } from '@/components/search-input';
import {
    signatureError,
    SignatureChoice,
    signatureReady,
} from '@/components/signature-choice';
import { RisFormPreview } from '@/components/signature/ris-form-preview';
import {
    CatalogRow,
    RequestLine,
    StockConflictNotice,
} from '@/components/staff/request-parts';
import type {
    CartItem,
    RequestableSupply,
    SupplyOption,
} from '@/components/staff/request-parts';
import { categoryLabels, supplyVisual } from '@/components/staff/supply-visual';
import type { SupplyCategoryKey } from '@/components/staff/supply-visual';
import { UserModeNotice } from '@/components/staff/user-mode-notice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatNumber, todayIso } from '@/lib/format';
import { officeOfDivision } from '@/lib/ris';
import { cn } from '@/lib/utils';
import { store as storeRis } from '@/routes/ris';
import { newRequest, requests as staffRequests } from '@/routes/staff';
import type {
    Department,
    PlacedSignature,
    RisDocument,
    SignatureType,
} from '@/types';

type Props = {
    supplies: RequestableSupply[];
    departments: Pick<Department, 'id' | 'name'>[];
};

type Step = 'items' | 'review';

type RequestForm = {
    entity_name: string;
    division: string;
    office: string;
    fund_cluster: string;
    responsibility_center_code: string;
    purpose: string;
    supplies: { supply_id: number; quantity: number }[];
    signature_type: SignatureType;
    signature: PlacedSignature | null;
};

/**
 * Items the server turned down because others requested them first: what
 * was asked for and the server's message, per supply, plus the supply list
 * the page had then (a newer one means "what's left" is known).
 */
type StockConflict = {
    asked: Map<number, number>;
    messages: Map<number, string>;
    supplies: RequestableSupply[];
};

/** What survives a refresh or a stray Back (never the signature). */
type Draft = {
    cart: { supply_id: number; quantity: number }[];
    fields: Pick<
        RequestForm,
        | 'entity_name'
        | 'division'
        | 'office'
        | 'responsibility_center_code'
        | 'purpose'
    >;
    officeTyped: boolean;
};

/** Rows rendered at first, and added each time the list end comes near. */
const PAGE_SIZE = 40;

const categoryOrder = Object.keys(categoryLabels) as SupplyCategoryKey[];

/**
 * New supply request, in two steps: choose the supplies (catalog on the
 * left, the request on the right), then review the form as it will print,
 * fill in the details and sign. The request is kept as a draft in this
 * browser until it is submitted.
 */
export default function RequestCreate({ supplies, departments }: Props) {
    const { auth } = usePage().props;
    const draftKey = `sinop:request-draft:${auth.user.id}`;
    const [step, setStep] = useState<Step>('items');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<SupplyCategoryKey | ''>('');
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [conflict, setConflict] = useState<StockConflict | null>(null);
    const [officeTyped, setOfficeTyped] = useState(false);
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
    const [restored, setRestored] = useState(false);
    const searchInput = useRef<HTMLInputElement>(null);

    const form = useForm<RequestForm>({
        entity_name: 'CHEDRO 12',
        division: auth.user.department_id
            ? String(auth.user.department_id)
            : '',
        office: '',
        fund_cluster: '',
        responsibility_center_code: '',
        purpose: '',
        supplies: [],
        signature_type: 'sgd',
        signature: null,
    });

    const divisionName = departments.find(
        (department) => String(department.id) === form.data.division,
    )?.name;

    // Office follows the division ("Scholarship Division - UniFAST BARMM" →
    // "UniFAST BARMM") until the person types their own.
    const office = officeTyped
        ? form.data.office
        : officeOfDivision(divisionName);

    // One row per supply (the server already picked each supply's largest
    // stock row), with its icon worked out once.
    const products = useMemo<SupplyOption[]>(
        () =>
            supplies.map((supply) => ({
                ...supply,
                visual: supplyVisual(supply.name, supply.category),
            })),
        [supplies],
    );

    const productById = useMemo(
        () => new Map(products.map((product) => [product.supply_id, product])),
        [products],
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

    const changeSearch = (value: string) => {
        setSearch(value);
        setLimit(PAGE_SIZE);
    };

    const changeCategory = (value: SupplyCategoryKey | '') => {
        setCategory(value);
        setLimit(PAGE_SIZE);
    };

    // Renders the next rows when the end of the list scrolls near. Keyed by
    // `limit`, so it's observed afresh after each batch.
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
            { rootMargin: '0px 0px 600px 0px' },
        );

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    // "/" jumps to the search box, as in most catalogs.
    useEffect(() => {
        const focusSearch = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;

            if (
                event.key === '/' &&
                step === 'items' &&
                !target?.closest('input, textarea, select, [contenteditable]')
            ) {
                event.preventDefault();
                searchInput.current?.focus();
            }
        };

        window.addEventListener('keydown', focusSearch);

        return () => window.removeEventListener('keydown', focusSearch);
    }, [step]);

    const inRequest = useMemo(
        () => new Map(cart.map((item) => [item.supply_id, item.quantity])),
        [cart],
    );

    /** Sets a supply's quantity in the request; 0 takes it out. */
    const setQuantity = useCallback(
        (supply: RequestableSupply, quantity: number) => {
            setCart((current) => {
                const existing = current.find(
                    (item) => item.supply_id === supply.supply_id,
                );
                const next = Math.max(
                    0,
                    Math.min(existing?.max ?? supply.available, quantity),
                );

                if (next === 0) {
                    return current.filter(
                        (item) => item.supply_id !== supply.supply_id,
                    );
                }

                if (existing) {
                    return current.map((item) =>
                        item.supply_id === supply.supply_id
                            ? { ...item, quantity: next }
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
                        quantity: next,
                        max: supply.available,
                    },
                ];
            });
        },
        [],
    );

    const setLineQuantity = (item: CartItem, quantity: number) =>
        setCart((current) =>
            current
                .map((line) =>
                    line.supply_id === item.supply_id
                        ? {
                              ...line,
                              quantity: Math.max(
                                  0,
                                  Math.min(line.max, quantity),
                              ),
                          }
                        : line,
                )
                .filter((line) => line.quantity > 0),
        );

    const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);

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

    // The draft: restored once (after the first paint, so the server-rendered
    // page and the browser agree), then saved on every change.
    const draftLoaded = useRef(false);

    useEffect(() => {
        if (draftLoaded.current) {
            return;
        }

        draftLoaded.current = true;
        const draft = readDraft(draftKey);

        if (!draft) {
            return;
        }

        const items = draft.cart.flatMap(({ supply_id, quantity }) => {
            const supply = productById.get(supply_id);
            const kept = supply ? Math.min(quantity, supply.available) : 0;

            return supply && kept > 0
                ? [
                      {
                          supply_id,
                          name: supply.name,
                          description: supply.description,
                          unit: supply.unit ?? '',
                          quantity: kept,
                          max: supply.available,
                      },
                  ]
                : [];
        });

        setCart(items);
        form.setData((data) => ({ ...data, ...draft.fields }));
        setOfficeTyped(draft.officeTyped);
        setRestored(items.length > 0);
        // Runs once, with the catalog the page arrived with.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { entity_name, division, responsibility_center_code, purpose } =
        form.data;

    useEffect(() => {
        if (!draftLoaded.current) {
            return;
        }

        writeDraft(draftKey, {
            cart: cart.map(({ supply_id, quantity }) => ({
                supply_id,
                quantity,
            })),
            fields: {
                entity_name,
                division,
                office: form.data.office,
                responsibility_center_code,
                purpose,
            },
            officeTyped,
        });
    }, [
        draftKey,
        cart,
        entity_name,
        division,
        form.data.office,
        responsibility_center_code,
        purpose,
        officeTyped,
    ]);

    const startOver = () => {
        clearDraft(draftKey);
        setCart([]);
        setRestored(false);
        setConflict(null);
        form.reset();
        form.clearErrors();
        setOfficeTyped(false);
        setSignatureUrl(null);
    };

    const goTo = (next: Step) => {
        if (next === 'review' && cart.length === 0) {
            form.setError('supplies', 'Add at least one item to your request.');

            return;
        }

        form.clearErrors('supplies');
        setStep(next);
        window.scrollTo({ top: 0 });
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
            onSuccess: () => clearDraft(draftKey),
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
                    router.reload({ only: ['supplies'] });
                    setStep('items');
                    window.scrollTo({ top: 0 });
                }
            },
        });
    };

    // The form as it will print.
    const draft = useMemo<RisDocument>(
        () => ({
            ris_no: null,
            entity_name,
            fund_cluster: null,
            division: divisionName ?? null,
            office,
            responsibility_center_code: responsibility_center_code || null,
            purpose: purpose || null,
            items: cart.map((item) => ({
                stock_no: productById.get(item.supply_id)?.stock_no ?? null,
                unit: item.unit,
                description: [item.name, item.description]
                    .filter(Boolean)
                    .join(', '),
                requested: item.quantity,
                available: null,
                issued: null,
                remarks: null,
            })),
            signatories: {
                requested: null,
                approved: null,
                issued: null,
                received: null,
            },
        }),
        [
            entity_name,
            divisionName,
            office,
            responsibility_center_code,
            purpose,
            cart,
            productById,
        ],
    );

    // The review shows the person in their box, signed the way they chose.
    const signed = form.data.signature;
    const preview = useMemo<RisDocument>(
        () => ({
            ...draft,
            signatories: {
                ...draft.signatories,
                requested: {
                    name: auth.user.name,
                    designation: auth.user.designation?.name ?? null,
                    date: todayIso(),
                    type: form.data.signature_type,
                    signature:
                        form.data.signature_type === 'esign' &&
                        signed &&
                        signatureUrl
                            ? { url: signatureUrl, placement: signed }
                            : null,
                },
            },
        }),
        [draft, auth.user, form.data.signature_type, signed, signatureUrl],
    );

    const stockErrors = Object.entries(
        form.errors as Record<string, string | undefined>,
    )
        .filter(([key]) => key.startsWith('supplies.'))
        .map(([, message]) => message)
        .filter(Boolean);

    return (
        <>
            <Head title="New supply request" />
            <PageContainer className="pb-24 lg:pb-6">
                <UserModeNotice />

                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold tracking-tight">
                            New supply request
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {step === 'items'
                                ? 'Choose the supplies you need. Quantities are limited to what is available.'
                                : 'Check the form as it will print, fill in the details, and sign.'}
                        </p>
                    </div>
                    <Steps
                        current={step}
                        onItems={() => goTo('items')}
                        canReview={cart.length > 0}
                        onReview={() => goTo('review')}
                    />
                </header>

                {step === 'items' ? (
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <section aria-label="Supplies" className="min-w-0">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div
                                    role="group"
                                    aria-label="Filter by category"
                                    className="-mb-px flex gap-1 overflow-x-auto"
                                >
                                    <CategoryTab
                                        label="All"
                                        count={products.length}
                                        active={category === ''}
                                        onClick={() => changeCategory('')}
                                    />
                                    {categoryCounts.length > 1 &&
                                        categoryCounts.map(({ key, count }) => (
                                            <CategoryTab
                                                key={key}
                                                label={categoryLabels[key]}
                                                count={count}
                                                active={category === key}
                                                onClick={() =>
                                                    changeCategory(key)
                                                }
                                            />
                                        ))}
                                </div>
                                <div className="relative sm:w-72">
                                    <SearchInput
                                        ref={searchInput}
                                        placeholder="Search supplies"
                                        aria-label="Search supplies"
                                        value={search}
                                        onValueChange={changeSearch}
                                    />
                                    {!search && (
                                        <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground sm:block">
                                            /
                                        </kbd>
                                    )}
                                </div>
                            </div>

                            <div className="mt-3 overflow-hidden rounded-lg border bg-card">
                                <div className="hidden items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground sm:flex">
                                    <span className="w-9" />
                                    <span className="flex-1">Item</span>
                                    <span className="w-36">Stock</span>
                                    <span className="w-[7.5rem] text-right">
                                        Quantity
                                    </span>
                                </div>
                                {visibleProducts.length === 0 ? (
                                    <EmptyState
                                        icon={SearchX}
                                        title={
                                            products.length === 0
                                                ? 'No supplies to request yet'
                                                : 'Nothing matches your search'
                                        }
                                        description={
                                            products.length === 0
                                                ? 'Supplies appear here once the supply office records stock.'
                                                : 'Try another word, or look in All.'
                                        }
                                    />
                                ) : (
                                    <ul className="divide-y">
                                        {shownProducts.map((product) => (
                                            <CatalogRow
                                                key={product.supply_id}
                                                supply={product}
                                                inRequest={
                                                    inRequest.get(
                                                        product.supply_id,
                                                    ) ?? 0
                                                }
                                                onQuantity={setQuantity}
                                            />
                                        ))}
                                    </ul>
                                )}
                                {hasMore && (
                                    <div
                                        key={limit}
                                        ref={observeListEnd}
                                        className="border-t py-3 text-center text-xs text-muted-foreground"
                                    >
                                        Loading more…
                                    </div>
                                )}
                            </div>
                        </section>

                        <aside className="min-w-0 rounded-lg border bg-card lg:sticky lg:top-6">
                            <div className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
                                <h2 className="font-medium">Your request</h2>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {cart.length}{' '}
                                    {cart.length === 1 ? 'item' : 'items'} ·{' '}
                                    {formatNumber(totalUnits)}{' '}
                                    {totalUnits === 1 ? 'unit' : 'units'}
                                </span>
                            </div>

                            {restored && (
                                <p className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                                    Picked up where you left off.
                                    <button
                                        type="button"
                                        onClick={startOver}
                                        className="font-medium text-foreground underline-offset-4 hover:underline"
                                    >
                                        Start over
                                    </button>
                                </p>
                            )}

                            {(conflict || stockErrors.length > 0) && (
                                <div className="space-y-2 border-b p-3">
                                    {conflict ? (
                                        <StockConflictNotice
                                            checking={!refreshed}
                                            onApplyWhatsLeft={applyWhatsLeft}
                                        />
                                    ) : (
                                        <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                                            {stockErrors.map((message) => (
                                                <li key={message}>{message}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {cart.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                                    <PackageOpen className="size-6 text-muted-foreground" />
                                    <p className="text-sm font-medium">
                                        Nothing added yet
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Use Add on the supplies you need.
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y lg:max-h-[calc(100vh-17rem)] lg:overflow-y-auto">
                                    {cart.map((item) => (
                                        <RequestLine
                                            key={item.supply_id}
                                            item={item}
                                            visual={
                                                productById.get(item.supply_id)
                                                    ?.visual ??
                                                supplyVisual(item.name, null)
                                            }
                                            asked={conflict?.asked.get(
                                                item.supply_id,
                                            )}
                                            left={leftNow(item.supply_id)}
                                            serverMessage={conflict?.messages.get(
                                                item.supply_id,
                                            )}
                                            onQuantity={(value) =>
                                                setLineQuantity(item, value)
                                            }
                                        />
                                    ))}
                                </ul>
                            )}

                            <div className="hidden space-y-2 border-t p-4 lg:block">
                                <InputError message={form.errors.supplies} />
                                <Button
                                    type="button"
                                    className="w-full"
                                    onClick={() => goTo('review')}
                                    disabled={cart.length === 0}
                                >
                                    Continue to review
                                </Button>
                                <Button
                                    asChild
                                    variant="ghost"
                                    className="w-full text-muted-foreground"
                                >
                                    <Link href={staffRequests()}>Cancel</Link>
                                </Button>
                            </div>
                        </aside>

                        {/* Phones: the next step stays in reach. */}
                        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
                            <span className="text-sm tabular-nums">
                                <span className="font-medium">
                                    {cart.length}
                                </span>{' '}
                                <span className="text-muted-foreground">
                                    {cart.length === 1 ? 'item' : 'items'}
                                </span>
                            </span>
                            <Button
                                type="button"
                                onClick={() => goTo('review')}
                                disabled={cart.length === 0}
                            >
                                Continue to review
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form
                        onSubmit={submit}
                        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]"
                    >
                        <section aria-label="Form preview" className="min-w-0">
                            <div className="rounded-lg border bg-muted/40 p-3 sm:p-6">
                                <RisFormPreview
                                    document={preview}
                                    className="mx-auto max-w-4xl"
                                />
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                The form as it will print. The RIS number is
                                given when you submit.
                            </p>
                        </section>

                        <aside className="grid min-w-0 gap-5 lg:sticky lg:top-6">
                            <section className="grid gap-4 rounded-lg border bg-card p-4">
                                <h2 className="font-medium">Details</h2>
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
                                        options={departments.map(
                                            (department) => ({
                                                value: department.id,
                                                label: department.name,
                                            }),
                                        )}
                                    />
                                </FormField>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
                                                form.setData(
                                                    'office',
                                                    e.target.value,
                                                );
                                            }}
                                        />
                                    </FormField>
                                    <FormField
                                        label="Responsibility center code"
                                        htmlFor="responsibility_center_code"
                                        error={
                                            form.errors
                                                .responsibility_center_code
                                        }
                                    >
                                        <Input
                                            id="responsibility_center_code"
                                            value={responsibility_center_code}
                                            onChange={(e) =>
                                                form.setData(
                                                    'responsibility_center_code',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    </FormField>
                                </div>
                                <FormField
                                    label="Entity name"
                                    htmlFor="entity_name"
                                    error={form.errors.entity_name}
                                    required
                                >
                                    <Input
                                        id="entity_name"
                                        value={entity_name}
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
                                    label="Purpose"
                                    htmlFor="purpose"
                                    error={form.errors.purpose}
                                >
                                    <Textarea
                                        id="purpose"
                                        rows={2}
                                        value={purpose}
                                        onChange={(e) =>
                                            form.setData(
                                                'purpose',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Optional"
                                    />
                                </FormField>
                            </section>

                            <section className="rounded-lg border bg-card p-4">
                                <SignatureChoice
                                    value={form.data.signature_type}
                                    onChange={(value) =>
                                        form.setData('signature_type', value)
                                    }
                                    step="requested"
                                    document={{ draft }}
                                    signature={form.data.signature}
                                    onSignatureChange={(signature, url) => {
                                        form.setData('signature', signature);
                                        setSignatureUrl(url ?? null);
                                    }}
                                    showPreview={false}
                                />
                                <InputError
                                    className="mt-2"
                                    message={signatureError(form.errors)}
                                />
                            </section>

                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end lg:flex-col-reverse xl:flex-row">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => goTo('items')}
                                >
                                    <ArrowLeft />
                                    Back to items
                                </Button>
                                <Button
                                    type="submit"
                                    className="sm:min-w-40"
                                    disabled={
                                        form.processing ||
                                        !form.data.division ||
                                        !signatureReady(
                                            form.data.signature_type,
                                            form.data.signature,
                                        )
                                    }
                                >
                                    {form.processing && <Spinner />}
                                    Submit request
                                </Button>
                            </div>
                        </aside>
                    </form>
                )}
            </PageContainer>
        </>
    );
}

RequestCreate.layout = {
    breadcrumbs: [
        { title: 'My requests', href: staffRequests() },
        { title: 'New request', href: newRequest() },
    ],
};

/** "1 Items — 2 Review & sign", the current one marked. */
function Steps({
    current,
    onItems,
    onReview,
    canReview,
}: {
    current: Step;
    onItems: () => void;
    onReview: () => void;
    canReview: boolean;
}) {
    const steps: {
        key: Step;
        label: string;
        go: () => void;
        enabled: boolean;
    }[] = [
        { key: 'items', label: 'Items', go: onItems, enabled: true },
        {
            key: 'review',
            label: 'Review & sign',
            go: onReview,
            enabled: canReview,
        },
    ];

    return (
        <ol className="flex items-center gap-3 text-sm">
            {steps.map((item, index) => {
                const active = item.key === current;
                const done = current === 'review' && item.key === 'items';

                return (
                    <li key={item.key} className="flex items-center gap-3">
                        {index > 0 && (
                            <span aria-hidden className="h-px w-8 bg-border" />
                        )}
                        <button
                            type="button"
                            onClick={item.go}
                            disabled={active || !item.enabled}
                            aria-current={active ? 'step' : undefined}
                            className={cn(
                                'flex items-center gap-2 rounded-md disabled:cursor-default',
                                active
                                    ? 'font-medium text-foreground'
                                    : 'text-muted-foreground enabled:hover:text-foreground',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-6 items-center justify-center rounded-full border text-xs tabular-nums',
                                    active &&
                                        'border-primary bg-primary text-primary-foreground',
                                    done && 'border-primary text-primary',
                                )}
                            >
                                {done ? (
                                    <Check className="size-3.5" />
                                ) : (
                                    index + 1
                                )}
                            </span>
                            {item.label}
                        </button>
                    </li>
                );
            })}
        </ol>
    );
}

function CategoryTab({
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
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                active
                    ? 'bg-secondary font-medium text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            {label}
            <span className="ml-1.5 text-xs tabular-nums opacity-70">
                {count}
            </span>
        </button>
    );
}

// The draft lives in this browser only. Storage can be unavailable (private
// windows, blocked site data), so every access is guarded.
function readDraft(key: string): Draft | null {
    try {
        const raw = window.localStorage.getItem(key);
        const draft = raw ? (JSON.parse(raw) as Draft) : null;

        return draft && Array.isArray(draft.cart) && draft.fields
            ? draft
            : null;
    } catch {
        return null;
    }
}

function writeDraft(key: string, draft: Draft): void {
    try {
        if (draft.cart.length === 0 && !draft.fields.purpose) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, JSON.stringify(draft));
        }
    } catch {
        // Not saved; the request still works.
    }
}

function clearDraft(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // Nothing to clear.
    }
}
