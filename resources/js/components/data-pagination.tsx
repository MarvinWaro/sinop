import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Paginated } from '@/types';

type Props = {
    paginator: Pick<
        Paginated<unknown>,
        'links' | 'from' | 'to' | 'total' | 'last_page'
    >;
    className?: string;
    /** Keep other page state (open sections, other paginators) when paging. */
    preserveState?: boolean;
};

function cleanLabel(label: string): string {
    return label
        .replace(/&laquo;|&raquo;/g, '')
        .replace(/Previous|Next/g, '')
        .trim();
}

export function DataPagination({
    paginator,
    className,
    preserveState = true,
}: Props) {
    if (paginator.total === 0) {
        return null;
    }

    const links = paginator.links ?? [];
    const prev = links[0];
    const next = links[links.length - 1];
    const pages = links.slice(1, -1);

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-between gap-3 sm:flex-row',
                className,
            )}
        >
            <p className="text-sm text-muted-foreground">
                Showing{' '}
                <span className="font-medium text-foreground">
                    {paginator.from ?? 0}
                </span>{' '}
                to{' '}
                <span className="font-medium text-foreground">
                    {paginator.to ?? 0}
                </span>{' '}
                of{' '}
                <span className="font-medium text-foreground">
                    {paginator.total}
                </span>{' '}
                results
            </p>

            {paginator.last_page > 1 && (
                <nav
                    className="flex flex-wrap items-center gap-1"
                    aria-label="Pagination"
                >
                    <PageLink
                        url={prev?.url ?? null}
                        preserveState={preserveState}
                        label="Previous"
                    >
                        <ChevronLeft className="size-4" />
                    </PageLink>
                    {pages.map((link, index) =>
                        link.url === null ? (
                            <span
                                key={`gap-${index}`}
                                className="px-2 text-sm text-muted-foreground"
                            >
                                {cleanLabel(link.label)}
                            </span>
                        ) : (
                            <PageLink
                                key={`${link.label}-${index}`}
                                url={link.url}
                                active={link.active}
                                preserveState={preserveState}
                                label={`Page ${cleanLabel(link.label)}`}
                            >
                                {cleanLabel(link.label)}
                            </PageLink>
                        ),
                    )}
                    <PageLink
                        url={next?.url ?? null}
                        preserveState={preserveState}
                        label="Next"
                    >
                        <ChevronRight className="size-4" />
                    </PageLink>
                </nav>
            )}
        </div>
    );
}

function PageLink({
    url,
    active = false,
    preserveState,
    label,
    children,
}: {
    url: string | null;
    active?: boolean;
    preserveState: boolean;
    label: string;
    children: React.ReactNode;
}) {
    const classes = cn(
        buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }),
        'min-w-8 px-2',
    );

    if (!url) {
        return (
            <span
                aria-disabled
                className={cn(classes, 'pointer-events-none opacity-50')}
            >
                {children}
            </span>
        );
    }

    return (
        <Link
            href={url}
            preserveScroll
            preserveState={preserveState}
            className={classes}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
        >
            {children}
        </Link>
    );
}
