import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** CHED Regional Office XII seal (public/img/ched-logo.png). */
export default function AppLogoIcon({
    className,
    alt = 'CHED Regional Office XII',
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src="/img/ched-logo.png"
            alt={alt}
            className={cn('object-contain', className)}
            {...props}
        />
    );
}
