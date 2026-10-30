import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
    count: number;
    onAdd: () => void;
    title?: string;
    description?: ReactNode;
    /** Extra controls shown before "Add item". */
    children?: ReactNode;
};

/**
 * Header of an item list inside a scrolling dialog. It sticks to the top
 * while the rows scroll, so "Add item" is always one click away.
 */
export function LineItemsToolbar({
    count,
    onAdd,
    title = 'Supply items',
    description,
    children,
}: Props) {
    return (
        <div className="sticky top-0 z-10 -mx-6 flex flex-col gap-2 border-b bg-background px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <h3 className="font-medium">
                    {title}{' '}
                    <span className="font-normal text-muted-foreground tabular-nums">
                        ({count})
                    </span>
                </h3>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-4">
                {children}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAdd}
                >
                    <Plus />
                    Add item
                </Button>
            </div>
        </div>
    );
}
