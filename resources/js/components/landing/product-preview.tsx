import {
    ArrowRight,
    ClipboardList,
    TrendingUp,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { RisStatusBadge } from '@/components/status-badges';
import { cn } from '@/lib/utils';
import type { RisSlip } from '@/types';

type SlipStatus = Pick<RisSlip, 'status' | 'received_at'>;

// The top row walks through an RIS's life: pending → approved → issued → completed.
const LIFECYCLE: SlipStatus[] = [
    { status: 'draft', received_at: null },
    { status: 'approved', received_at: null },
    { status: 'posted', received_at: null },
    { status: 'posted', received_at: 'received' },
];

// Sample rows for the illustration only; no real data is shown to guests.
const SAMPLE_ROWS: {
    number: string;
    detail: string;
    slip: SlipStatus;
}[] = [
    {
        number: 'RIS 2026-10-117',
        detail: 'Administrative Division · 3 items',
        slip: { status: 'posted', received_at: 'received' },
    },
    {
        number: 'RIS 2026-10-116',
        detail: 'Technical Division · 9 items',
        slip: { status: 'posted', received_at: null },
    },
    {
        number: 'RIS 2026-10-115',
        detail: 'Office of the Director · 2 items',
        slip: { status: 'approved', received_at: null },
    },
];

const ISSUED_THIS_WEEK = [38, 62, 47, 80, 55, 92, 70];

/**
 * Illustrated SINOP screen for the landing page and sign-in panel: an RIS
 * list whose newest slip moves through its statuses, plus floating low-stock
 * and issuance cards. Decorative (aria-hidden) and built from sample data.
 */
export function ProductPreview({
    compact = false,
    className,
}: {
    /** Fewer rows, for the sign-in panel. */
    compact?: boolean;
    className?: string;
}) {
    const rows = compact ? SAMPLE_ROWS.slice(0, 2) : SAMPLE_ROWS;

    return (
        <div
            aria-hidden
            className={cn('relative w-full select-none', className)}
        >
            <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl shadow-ring/15">
                <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-3">
                    <span className="size-2.5 rounded-full bg-red-400/80" />
                    <span className="size-2.5 rounded-full bg-amber-400/80" />
                    <span className="size-2.5 rounded-full bg-emerald-400/80" />
                    <span className="ml-3 text-xs text-muted-foreground">
                        SINOP · Requisitions
                    </span>
                </div>

                <div className="space-y-4 p-5">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground">
                                October 2026
                            </p>
                            <p className="font-semibold">
                                Requisition and Issue Slips
                            </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            12 this week
                        </span>
                    </div>

                    <ul className="divide-y rounded-xl border">
                        <PreviewRow
                            number="RIS 2026-10-118"
                            detail="Technical Division · 6 items"
                            highlighted
                            badge={<LifecycleBadge />}
                        />
                        {rows.map((row) => (
                            <PreviewRow
                                key={row.number}
                                number={row.number}
                                detail={row.detail}
                                badge={<RisStatusBadge slip={row.slip} />}
                            />
                        ))}
                    </ul>

                    {/* Room for the floating chart card, which overlaps here. */}
                    <p className="flex items-center justify-end gap-1 text-xs font-medium text-primary">
                        View all requisitions
                        <ArrowRight className="size-3.5" />
                    </p>
                </div>
            </div>

            <div className="absolute -top-6 -right-3 w-56 rounded-xl border bg-card p-3.5 text-card-foreground shadow-xl shadow-ring/10 will-change-transform motion-safe:animate-float sm:-right-8">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <TriangleAlert className="size-3.5" />
                    Low stock
                </div>
                <p className="mt-1.5 text-sm font-medium">Bond paper, A4</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-1/5 rounded-full bg-amber-500" />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                    4 reams left · reorder at 10
                </p>
            </div>

            <div
                className="absolute -bottom-14 -left-3 w-60 rounded-xl border bg-card p-3.5 text-card-foreground shadow-xl shadow-ring/10 will-change-transform motion-safe:animate-float sm:-left-8"
                style={{ animationDelay: '-4s' }}
            >
                <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                        Issued this week
                    </p>
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <TrendingUp className="size-3.5" />
                        18%
                    </span>
                </div>
                <div className="mt-3 flex h-14 items-end gap-1.5">
                    {ISSUED_THIS_WEEK.map((height, index) => (
                        <div
                            key={index}
                            className={cn(
                                'flex-1 rounded-sm',
                                index === ISSUED_THIS_WEEK.length - 1
                                    ? 'bg-primary'
                                    : 'bg-ring/25',
                            )}
                            style={{ height: `${height}%` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * The cycling status. Kept in its own component so the timer re-renders
 * only this badge, not the whole preview.
 */
function LifecycleBadge() {
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const timer = window.setInterval(
            () => setStep((current) => (current + 1) % LIFECYCLE.length),
            2600,
        );

        return () => window.clearInterval(timer);
    }, []);

    return (
        <RisStatusBadge
            key={step}
            slip={LIFECYCLE[step]}
            className="motion-safe:animate-in motion-safe:duration-300 motion-safe:zoom-in-95 motion-safe:fade-in"
        />
    );
}

function PreviewRow({
    number,
    detail,
    badge,
    highlighted = false,
}: {
    number: string;
    detail: string;
    badge: ReactNode;
    highlighted?: boolean;
}) {
    return (
        <li
            className={cn(
                'flex items-center gap-3 px-4 py-3',
                highlighted && 'bg-primary/5',
            )}
        >
            <span
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    highlighted
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground',
                )}
            >
                <ClipboardList className="size-4" />
            </span>
            {/* On narrow screens the badge drops below the text. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="min-w-36 flex-1">
                    <p className="truncate text-sm font-medium">{number}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        {detail}
                    </p>
                </div>
                {badge}
            </div>
        </li>
    );
}
