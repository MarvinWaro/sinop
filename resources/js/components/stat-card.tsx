import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    value: ReactNode;
    icon?: LucideIcon;
    description?: ReactNode;
    href?: NonNullable<InertiaLinkProps['href']>;
    className?: string;
};

export function StatCard({
    title,
    value,
    icon: Icon,
    description,
    href,
    className,
}: Props) {
    const content = (
        <Card
            className={cn(
                'gap-0 py-4 transition-colors',
                href && 'hover:bg-muted/50',
                className,
            )}
        >
            <CardContent className="flex items-start justify-between gap-4 px-4">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                        {title}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight">
                        {value}
                    </p>
                    {description && (
                        <p className="text-xs text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {Icon && (
                    <div className="rounded-md border bg-muted/50 p-2 text-muted-foreground">
                        <Icon className="size-5" />
                    </div>
                )}
            </CardContent>
        </Card>
    );

    return href ? (
        <Link
            href={href}
            className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
            {content}
        </Link>
    ) : (
        content
    );
}
