import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';
import { home } from '@/routes';

/** CHED seal + "SINOP / CHED Regional Office XII", linking home. */
export function BrandMark({
    subtitleClassName,
}: {
    /** e.g. "hidden sm:block" to drop the office name on phones. */
    subtitleClassName?: string;
}) {
    return (
        <Link
            href={home()}
            className="flex items-center gap-3"
            aria-label="SINOP home"
        >
            <AppLogoIcon className="size-9" />
            <span className="leading-tight">
                <span className="block font-semibold tracking-tight">
                    SINOP
                </span>
                <span
                    className={cn(
                        'block text-xs text-muted-foreground',
                        subtitleClassName,
                    )}
                >
                    CHED Regional Office XII
                </span>
            </span>
        </Link>
    );
}
