import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode, SyntheticEvent } from 'react';
import { boxAspect, frameOf } from '@/lib/signature-placement';
import { cn } from '@/lib/utils';
import type { BoxSignature, Placement, SignStep } from '@/types';

/** Height ÷ width a signature is assumed to have until its image loads. */
const TYPICAL_RATIO = 1 / 3;

/** Where a signature image goes inside its box (percentages of the box). */
export function signatureStyle(
    step: SignStep,
    placement: Placement,
    ratio: number,
): CSSProperties {
    const frame = frameOf(step, placement, ratio);

    return {
        left: `${frame.left * 100}%`,
        top: `${frame.top * 100}%`,
        width: `${frame.width * 100}%`,
        height: `${frame.height * 100}%`,
        transform: placement.rotation
            ? `rotate(${placement.rotation}deg)`
            : undefined,
    };
}

/**
 * Ink on the page. On paper (the form preview) it is drawn as is; in the app
 * it turns light in dark mode: inverting makes black ink white, the hue turn
 * keeps blue ink blue.
 */
export const inkClass = (paper: boolean) =>
    paper ? '' : 'dark:invert dark:hue-rotate-180';

/**
 * A signature box of the RIS form at its true proportions, with the
 * signature where its signer placed it. Signatures from before placements
 * were kept are centred.
 */
export function SignatureBox({
    step,
    signature,
    paper = false,
    label = '',
    className,
    style,
    children,
}: {
    step: SignStep;
    signature: BoxSignature | null;
    /** Text for screen readers (empty: decorative). */
    label?: string;
    /** Drawn on the white form preview (no dark-mode colours). */
    paper?: boolean;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
}) {
    const [ratio, setRatio] = useState(TYPICAL_RATIO);
    const measured = useImageRatio(setRatio);

    return (
        <div
            className={cn('relative w-full', className)}
            style={{ aspectRatio: boxAspect(step), ...style }}
        >
            {signature &&
                (signature.placement ? (
                    <img
                        src={signature.url}
                        alt={label}
                        draggable={false}
                        {...measured}
                        className={cn(
                            'pointer-events-none absolute max-w-none object-contain select-none',
                            inkClass(paper),
                        )}
                        style={signatureStyle(step, signature.placement, ratio)}
                    />
                ) : (
                    <img
                        src={signature.url}
                        alt={label}
                        draggable={false}
                        className={cn(
                            'pointer-events-none absolute inset-0 m-auto max-h-[80%] max-w-[90%] object-contain select-none',
                            inkClass(paper),
                        )}
                    />
                ))}
            {children}
        </div>
    );
}

/** Height ÷ width of a loaded image. */
export function imageRatio(image: HTMLImageElement): number {
    return image.naturalWidth > 0
        ? image.naturalHeight / image.naturalWidth
        : TYPICAL_RATIO;
}

/**
 * Props for an <img> that report its height ÷ width once known: on load,
 * or at once when it had loaded before React attached the handler (from the
 * cache, or server-rendered markup). Only changes are reported.
 */
export function useImageRatio(onChange: (ratio: number) => void) {
    const last = useRef<number | null>(null);

    const report = (image: HTMLImageElement | null) => {
        if (!image?.complete || image.naturalWidth === 0) {
            return;
        }

        const ratio = imageRatio(image);

        if (ratio !== last.current) {
            last.current = ratio;
            onChange(ratio);
        }
    };

    return {
        ref: report,
        onLoad: (event: SyntheticEvent<HTMLImageElement>) =>
            report(event.currentTarget),
    };
}
