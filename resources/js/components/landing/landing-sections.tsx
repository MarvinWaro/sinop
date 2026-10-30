import {
    BadgeCheck,
    Check,
    ClipboardList,
    FileSpreadsheet,
    Laptop,
    Package,
    PackageCheck,
    Printer,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConditionBadge } from '@/components/status-badges';
import { cn } from '@/lib/utils';

const steps: { icon: LucideIcon; title: string; description: string }[] = [
    {
        icon: ClipboardList,
        title: 'Request',
        description:
            'Staff submit a requisition and issue slip (RIS) for the supplies they need.',
    },
    {
        icon: BadgeCheck,
        title: 'Approve',
        description:
            'The Chief Administrative Officer reviews and approves the request.',
    },
    {
        icon: PackageCheck,
        title: 'Issue',
        description:
            'Supply issues the items and the stock on hand is updated right away.',
    },
    {
        icon: FileSpreadsheet,
        title: 'Report',
        description:
            'Stock cards, ledger cards, RSMI and RPCI are ready to print or export.',
    },
];

// Sample figures for the illustrations only.
const sampleStock = [
    { name: 'Ballpen, black', left: '36 pcs', level: 72, low: false },
    { name: 'Bond paper, A4', left: '4 reams', level: 18, low: true },
    { name: 'Folder, long', left: '23 pcs', level: 46, low: false },
];

const reportCards = [
    { title: 'Stock Card', icon: Printer },
    { title: 'Ledger Card', icon: Printer },
    { title: 'RSMI', icon: FileSpreadsheet },
    { title: 'RPCI', icon: FileSpreadsheet },
];

const timelineStages = ['Requested', 'Approved', 'Issued', 'Received'];

export function SectionHeading({
    eyebrow,
    title,
    description,
}: {
    eyebrow: string;
    title: string;
    description: string;
}) {
    return (
        <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-primary">{eyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {title}
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
                {description}
            </p>
        </div>
    );
}

/** Bento grid of the four modules, each with a small illustration. */
export function ModulesSection() {
    return (
        <section
            id="modules"
            className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-24"
        >
            <SectionHeading
                eyebrow="Modules"
                title="Every item, accounted for"
                description="From the delivery that comes in to the supplies that go out, each step is recorded once and reused everywhere."
            />

            <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ModuleCard
                    icon={ClipboardList}
                    title="Supply requests"
                    description="Request office supplies online and follow each RIS from approval to issuance."
                    className="lg:col-span-2"
                >
                    <RisTimeline />
                </ModuleCard>

                <ModuleCard
                    icon={Package}
                    title="Stock & IAR"
                    description="Record deliveries, track stock levels and get low-stock warnings."
                >
                    <ul className="space-y-3">
                        {sampleStock.map((item) => (
                            <li key={item.name}>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium">
                                        {item.name}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-muted-foreground',
                                            item.low &&
                                                'font-medium text-amber-700 dark:text-amber-300',
                                        )}
                                    >
                                        {item.left}
                                    </span>
                                </div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={cn(
                                            'h-full rounded-full',
                                            item.low
                                                ? 'bg-amber-500'
                                                : 'bg-primary',
                                        )}
                                        style={{ width: `${item.level}%` }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </ModuleCard>

                <ModuleCard
                    icon={Laptop}
                    title="Property & MR"
                    description="Keep laptops, furniture and equipment on record with the accountable employee."
                >
                    <div className="rounded-xl border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium">
                                    Laptop computer
                                </p>
                                <p className="font-mono text-xs text-muted-foreground">
                                    PN 2026-0142
                                </p>
                            </div>
                            <ConditionBadge condition="Serviceable" />
                        </div>
                        <div className="mt-4 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                MR
                            </span>
                            Assigned to the accountable employee
                        </div>
                    </div>
                </ModuleCard>

                <ModuleCard
                    icon={FileSpreadsheet}
                    title="Reports"
                    description="Stock cards, ledger cards, RSMI and RPCI ready to print or export."
                    className="lg:col-span-2"
                >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {reportCards.map((report) => (
                            <div
                                key={report.title}
                                className="rounded-lg border bg-background p-3 transition-transform duration-300 group-hover:-translate-y-0.5"
                            >
                                <div className="space-y-1.5">
                                    <div className="h-1.5 w-3/4 rounded-full bg-muted" />
                                    <div className="h-1.5 w-full rounded-full bg-muted" />
                                    <div className="h-1.5 w-2/3 rounded-full bg-muted" />
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                    <span className="truncate text-xs font-medium">
                                        {report.title}
                                    </span>
                                    <report.icon className="size-3.5 shrink-0 text-muted-foreground" />
                                </div>
                            </div>
                        ))}
                    </div>
                </ModuleCard>
            </div>
        </section>
    );
}

/** Request → Approve → Issue → Report. */
export function HowItWorksSection() {
    return (
        <section id="how-it-works" className="scroll-mt-20 border-t bg-card/40">
            <div className="mx-auto w-full max-w-6xl px-6 py-24">
                <SectionHeading
                    eyebrow="How it works"
                    title="From request to report in four steps"
                    description="The same flow the office already follows, without the paper chasing."
                />

                <div className="relative mt-14">
                    <div
                        aria-hidden
                        className="absolute top-6 right-[12.5%] left-[12.5%] hidden h-px bg-linear-to-r from-transparent via-border to-transparent md:block"
                    />
                    <ol className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-6">
                        {steps.map((step, index) => (
                            <li
                                key={step.title}
                                className="relative flex flex-col items-center text-center"
                            >
                                <span className="flex size-12 items-center justify-center rounded-full border bg-card text-primary shadow-sm">
                                    <step.icon className="size-5" />
                                </span>
                                <span className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    Step {index + 1}
                                </span>
                                <h3 className="mt-1 font-semibold">
                                    {step.title}
                                </h3>
                                <p className="mt-2 max-w-60 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}

function ModuleCard({
    icon: Icon,
    title,
    description,
    className,
    children,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <article
            className={cn(
                'group flex flex-col justify-between gap-8 rounded-2xl border bg-card p-6 text-card-foreground shadow-xs transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-ring/10',
                className,
            )}
        >
            <div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <Icon className="size-5" />
                </span>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
            <div aria-hidden>{children}</div>
        </article>
    );
}

/** An RIS's progress, with "Issued" in progress. */
function RisTimeline() {
    const current = 2;

    return (
        <div className="rounded-xl border bg-background p-5">
            <p className="text-xs font-medium">RIS 2026-10-118</p>
            <ol className="mt-5 flex items-start">
                {timelineStages.map((stage, index) => {
                    const done = index < current;
                    const active = index === current;

                    return (
                        <li
                            key={stage}
                            className="relative flex flex-1 flex-col items-center gap-2"
                        >
                            {index > 0 && (
                                <span
                                    className={cn(
                                        'absolute top-3 right-1/2 h-0.5 w-full',
                                        index <= current
                                            ? 'bg-primary'
                                            : 'bg-border',
                                    )}
                                />
                            )}
                            <span
                                className={cn(
                                    'relative flex size-6 items-center justify-center rounded-full border-2 bg-background',
                                    done &&
                                        'border-primary bg-primary text-primary-foreground',
                                    active && 'border-primary',
                                    !done && !active && 'border-border',
                                )}
                            >
                                {done && <Check className="size-3.5" />}
                                {active && (
                                    <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />
                                )}
                            </span>
                            <span
                                className={cn(
                                    'text-xs',
                                    done || active
                                        ? 'font-medium'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {stage}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
