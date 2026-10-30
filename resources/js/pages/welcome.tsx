import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import AppLogoIcon from '@/components/app-logo-icon';
import { AppearanceToggleButton } from '@/components/appearance-toggle';
import {
    AmbientBackground,
    BandPattern,
    brandPanel,
    useSpotlight,
} from '@/components/landing/ambient-background';
import { BrandMark } from '@/components/landing/brand-mark';
import {
    HowItWorksSection,
    ModulesSection,
} from '@/components/landing/landing-sections';
import { ProductPreview } from '@/components/landing/product-preview';
import { Button } from '@/components/ui/button';
import { usePublicAppearance } from '@/hooks/use-public-appearance';
import { cn } from '@/lib/utils';
import { dashboard, login, register } from '@/routes';

const governmentForms = [
    'RIS',
    'IAR',
    'Stock Card',
    'Supplies Ledger Card',
    'RSMI',
    'RPCI',
];

/** Smooth-scroll to an on-page section (instant with reduced motion). */
function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const target = document.getElementById(id);

    if (!target) {
        return;
    }

    event.preventDefault();
    target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
    });
}

/**
 * True once the page has scrolled past a sentinel at the top. Uses an
 * IntersectionObserver, so nothing runs on each scroll event.
 */
function useScrolledPast<T extends HTMLElement>() {
    const sentinel = useRef<T>(null);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const element = sentinel.current;

        if (!element) {
            return;
        }

        const observer = new IntersectionObserver(([entry]) =>
            setScrolled(!entry.isIntersecting),
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { sentinel, scrolled };
}

const sectionLinks = [
    { id: 'modules', label: 'Modules' },
    { id: 'how-it-works', label: 'How it works' },
];

export default function Welcome() {
    const { auth } = usePage().props;
    const spotlight = useSpotlight<HTMLDivElement>();
    const { sentinel, scrolled } = useScrolledPast<HTMLDivElement>();
    const appearance = usePublicAppearance();

    return (
        <>
            <Head title="Welcome" />
            <div
                ref={spotlight.ref}
                onPointerMove={spotlight.onPointerMove}
                onPointerLeave={spotlight.onPointerLeave}
                className="relative isolate flex min-h-svh flex-col overflow-x-clip bg-background text-foreground"
            >
                <div
                    ref={sentinel}
                    aria-hidden
                    className="absolute top-0 h-2 w-px"
                />
                <AmbientBackground className="h-[58rem]" />

                <header
                    className={cn(
                        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300',
                        scrolled
                            ? 'border-border/70 bg-background/75 backdrop-blur-xl'
                            : 'border-transparent',
                    )}
                >
                    <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
                        <BrandMark subtitleClassName="hidden sm:block" />

                        <nav
                            aria-label="Sections"
                            className="hidden items-center gap-1 text-sm text-muted-foreground md:flex"
                        >
                            {sectionLinks.map((link) => (
                                <a
                                    key={link.id}
                                    href={`#${link.id}`}
                                    onClick={(e) => scrollToSection(e, link.id)}
                                    className="rounded-md px-3 py-2 transition-colors hover:text-foreground"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>

                        <div className="flex items-center gap-1.5">
                            <AppearanceToggleButton
                                onToggle={appearance.toggle}
                            />
                            {auth.user ? (
                                <Button asChild>
                                    <Link href={dashboard()}>
                                        Go to dashboard
                                    </Link>
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        asChild
                                        variant="ghost"
                                        className="hidden sm:inline-flex"
                                    >
                                        <Link href={login()}>Log in</Link>
                                    </Button>
                                    <Button asChild>
                                        <Link href={register()}>Register</Link>
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1">
                    <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 px-6 pt-14 pb-24 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-32">
                        <div className="max-w-xl space-y-7 motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                            <p className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur">
                                <span className="relative flex size-2">
                                    <span className="absolute inline-flex size-full rounded-full bg-ring/60 motion-safe:animate-ping" />
                                    <span className="relative inline-flex size-2 rounded-full bg-ring" />
                                </span>
                                Masinop na pamamahala ng ari-arian at kagamitan
                            </p>
                            <h1 className="text-shimmer text-4xl font-semibold tracking-tight text-balance motion-safe:animate-shimmer sm:text-5xl lg:text-6xl">
                                Property and supply management for{' '}
                                <span className="text-shimmer [--shimmer-base:var(--primary)] [--shimmer-glint:color-mix(in_oklab,var(--ring)_45%,white)] motion-safe:animate-shimmer">
                                    CHEDRO XII
                                </span>
                            </h1>
                            <p className="text-lg text-pretty text-muted-foreground">
                                SINOP keeps the office&apos;s supplies,
                                requisitions and accountable property records in
                                one place, from the delivery receipt to the
                                printed report.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {auth.user ? (
                                    <Button
                                        asChild
                                        size="lg"
                                        className="h-11 px-6"
                                    >
                                        <Link href={dashboard()}>
                                            Go to dashboard
                                            <ArrowRight />
                                        </Link>
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            asChild
                                            size="lg"
                                            className="h-11 px-6 shadow-lg shadow-primary/20"
                                        >
                                            <Link href={login()}>
                                                Log in
                                                <ArrowRight />
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="lg"
                                            variant="outline"
                                            className="h-11 bg-card/70 px-6 backdrop-blur"
                                        >
                                            <Link href={register()}>
                                                Create an account
                                            </Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ring" />
                                For CHED Regional Office XII personnel. New
                                accounts are activated by the administrator.
                            </p>
                        </div>

                        <div className="px-4 motion-safe:animate-in motion-safe:duration-1000 motion-safe:fade-in motion-safe:slide-in-from-bottom-6 sm:px-8 lg:px-0">
                            <ProductPreview className="mx-auto max-w-xl" />
                        </div>
                    </section>

                    <section className="border-y bg-card/50 backdrop-blur-sm">
                        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-7 md:flex-row md:justify-between">
                            <p className="text-sm text-muted-foreground">
                                Built around the government forms you already
                                use
                            </p>
                            <ul className="flex flex-wrap justify-center gap-2">
                                {governmentForms.map((form) => (
                                    <li
                                        key={form}
                                        className="rounded-full border bg-background px-3 py-1 text-xs font-medium"
                                    >
                                        {form}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    <ModulesSection />
                    <HowItWorksSection />

                    <section className="mx-auto w-full max-w-6xl px-6 py-24">
                        <div
                            className={cn(
                                'relative isolate overflow-hidden rounded-3xl px-8 py-14 sm:px-14',
                                brandPanel.surface,
                            )}
                        >
                            <BandPattern className="-z-10" />
                            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                                <div className="max-w-xl space-y-3">
                                    <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                                        Ready when your office is
                                    </h2>
                                    <p className="text-pretty opacity-80">
                                        Log in with your account, or create one.
                                        The administrator activates new accounts
                                        before first use.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        asChild
                                        size="lg"
                                        className={cn(
                                            brandPanel.solidButton,
                                            'h-11 px-6',
                                        )}
                                    >
                                        <Link
                                            href={
                                                auth.user
                                                    ? dashboard()
                                                    : login()
                                            }
                                        >
                                            {auth.user
                                                ? 'Go to dashboard'
                                                : 'Log in'}
                                            <ArrowRight />
                                        </Link>
                                    </Button>
                                    {!auth.user && (
                                        <Button
                                            asChild
                                            size="lg"
                                            className={cn(
                                                brandPanel.outlineButton,
                                                'h-11 px-6',
                                            )}
                                        >
                                            <Link href={register()}>
                                                Create an account
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </main>

                <footer className="border-t">
                    <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
                        <div className="flex items-center gap-3">
                            <AppLogoIcon className="size-7" />
                            <span>
                                <span className="font-medium text-foreground">
                                    SINOP
                                </span>{' '}
                                · Property and supply management
                            </span>
                        </div>
                        <p>
                            © {new Date().getFullYear()} CHED Regional Office
                            XII
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
}
