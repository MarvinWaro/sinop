import { Plus, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserSignature } from '@/types';

/**
 * The person's saved signatures as tiles, the default first, plus a "New
 * signature" tile. Pick one (signing) or manage them (settings).
 */
export function SignatureLibrary({
    signatures,
    limit,
    selectedId,
    onSelect,
    onNew,
    onMakeDefault,
    onDelete,
    busy = false,
    className,
}: {
    signatures: UserSignature[];
    limit: number;
    selectedId?: number | null;
    onSelect?: (signature: UserSignature) => void;
    onNew: () => void;
    onMakeDefault?: (signature: UserSignature) => void;
    onDelete?: (signature: UserSignature) => void;
    busy?: boolean;
    className?: string;
}) {
    const manage = Boolean(onMakeDefault || onDelete);

    return (
        <ul className={cn('grid grid-cols-2 gap-3', className)}>
            {signatures.map((signature) => {
                const selected = signature.id === selectedId;

                return (
                    <li key={signature.id} className="grid min-w-0 gap-1.5">
                        <button
                            type="button"
                            onClick={() => onSelect?.(signature)}
                            disabled={!onSelect}
                            aria-pressed={onSelect ? selected : undefined}
                            className={cn(
                                'flex aspect-[5/2] min-w-0 items-center justify-center rounded-md border bg-white p-2 transition-shadow disabled:cursor-default',
                                selected
                                    ? 'border-primary ring-2 ring-primary/40'
                                    : onSelect && 'hover:border-foreground/40',
                            )}
                        >
                            <img
                                src={signature.url}
                                alt={signature.name}
                                draggable={false}
                                className="max-h-full max-w-full object-contain"
                            />
                        </button>
                        <div className="flex min-w-0 items-center gap-1">
                            <span className="truncate text-xs text-muted-foreground">
                                {signature.name}
                            </span>
                            {signature.is_default && (
                                <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0 text-[10px]"
                                >
                                    Default
                                </Badge>
                            )}
                            {manage && (
                                <span className="ml-auto flex shrink-0">
                                    {onMakeDefault && !signature.is_default && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            disabled={busy}
                                            onClick={() =>
                                                onMakeDefault(signature)
                                            }
                                            aria-label={`Make ${signature.name} the default`}
                                            title="Make default"
                                        >
                                            <Star className="size-3.5" />
                                        </Button>
                                    )}
                                    {onDelete && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 text-destructive"
                                            disabled={busy}
                                            onClick={() => onDelete(signature)}
                                            aria-label={`Delete ${signature.name}`}
                                            title="Delete"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    )}
                                </span>
                            )}
                        </div>
                    </li>
                );
            })}

            {signatures.length < limit && (
                <li className="grid min-w-0 gap-1.5">
                    <button
                        type="button"
                        onClick={onNew}
                        className="flex aspect-[5/2] items-center justify-center rounded-md border border-dashed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                    >
                        <Plus className="size-5" />
                        <span className="sr-only">New signature</span>
                    </button>
                    <span className="text-xs text-muted-foreground">
                        New signature
                    </span>
                </li>
            )}
        </ul>
    );
}
