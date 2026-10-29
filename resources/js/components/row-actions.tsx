import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Edit / delete icon buttons for a table row. */
export function RowActions({
    label,
    onEdit,
    onDelete,
}: {
    label: string;
    onEdit?: () => void;
    onDelete?: () => void;
}) {
    return (
        <div className="flex justify-end gap-1">
            {onEdit && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onEdit}
                    aria-label={`Edit ${label}`}
                    title="Edit"
                >
                    <Pencil />
                </Button>
            )}
            {onDelete && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    aria-label={`Delete ${label}`}
                    title="Delete"
                >
                    <Trash2 />
                </Button>
            )}
        </div>
    );
}
