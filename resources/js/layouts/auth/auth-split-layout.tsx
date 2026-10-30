import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { AppearanceToggleButton } from '@/components/appearance-toggle';
import {
    BandPattern,
    brandPanel,
} from '@/components/landing/ambient-background';
import { BrandMark } from '@/components/landing/brand-mark';
import { ProductPreview } from '@/components/landing/product-preview';
import { usePublicAppearance } from '@/hooks/use-public-appearance';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

/**
 * Sign-in screens: the form on the left, and on large screens a coloured
 * panel on the right with the same SINOP preview as the landing page. The
 * panel stays in view while a long form (registration) scrolls.
 */
export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const appearance = usePublicAppearance();

    return (
        <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex flex-col px-6 py-6 sm:px-10">
                <header className="flex items-center justify-between gap-4">
                    <BrandMark />
                    <div className="flex items-center gap-1">
                        <AppearanceToggleButton onToggle={appearance.toggle} />
                        <Link
                            href={home()}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="size-4" />
                            Home
                        </Link>
                    </div>
                </header>

                <main className="flex flex-1 items-center justify-center py-12">
                    <div className="w-full max-w-sm space-y-8 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
                        <div className="space-y-2">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {title}
                            </h1>
                            <p className="text-sm text-balance text-muted-foreground">
                                {description}
                            </p>
                        </div>
                        {children}
                    </div>
                </main>

                <footer className="text-xs text-muted-foreground">
                    © {new Date().getFullYear()} CHED Regional Office XII
                </footer>
            </div>

            <aside className="hidden lg:block">
                <div className="sticky top-0 h-svh p-3">
                    <div
                        className={cn(
                            'relative isolate flex h-full flex-col gap-10 overflow-hidden rounded-3xl p-10 xl:p-12',
                            brandPanel.surface,
                        )}
                    >
                        <BandPattern className="-z-10" />

                        <div className="max-w-md space-y-3">
                            <p className="text-sm font-medium opacity-70">
                                Masinop na pamamahala ng ari-arian at kagamitan
                            </p>
                            <h2 className="text-3xl font-semibold tracking-tight text-balance xl:text-4xl">
                                Every supply and property record, accounted for.
                            </h2>
                            <p className="text-pretty opacity-75">
                                Requisitions, deliveries, stock cards and
                                reports for CHED Regional Office XII, in one
                                place.
                            </p>
                        </div>

                        <div className="flex flex-1 items-center px-6 pb-8 xl:px-10">
                            <ProductPreview
                                compact
                                className="mx-auto max-w-lg"
                            />
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
