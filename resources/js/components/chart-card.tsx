import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

/** Card with a title/description header wrapping a chart or small table. */
export function ChartCard({
    title,
    description,
    actions,
    children,
    className,
    contentClassName,
}: {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    /** E.g. "flex flex-1 flex-col" to pin a footer to the card's bottom. */
    contentClassName?: string;
}) {
    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <CardTitle>{title}</CardTitle>
                    {description && (
                        <CardDescription>{description}</CardDescription>
                    )}
                </div>
                {actions}
            </CardHeader>
            <CardContent className={cn(contentClassName)}>
                {children}
            </CardContent>
        </Card>
    );
}
