import { RotateCw } from 'lucide-react';
import { useRef } from 'react';
import type {
    KeyboardEvent as ReactKeyboardEvent,
    PointerEvent as ReactPointerEvent,
} from 'react';
import {
    guardImage,
    signatureStyle,
    useImageRatio,
} from '@/components/signature/signature-box';
import { clampPlacement } from '@/lib/signature-placement';
import { cn } from '@/lib/utils';
import type { Placement, SignStep } from '@/types';

type Gesture =
    | { kind: 'move'; startX: number; startY: number; from: Placement }
    | { kind: 'resize'; startDistance: number; from: Placement }
    | { kind: 'rotate' };

const CORNERS = [
    'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
    'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
    'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
    'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
];

/**
 * Moves, resizes and tilts a signature inside its box. Fills the box it is
 * placed in (a SignatureBox); only that box's rectangle is measured, and
 * the result is kept as fractions of it, so it works at any zoom.
 *
 * Mouse, touch or pen: drag the signature, its corners or the round handle.
 * Keyboard: arrows move (Shift: further), + and − resize, [ and ] tilt.
 */
export function PlacementEditor({
    step,
    url,
    ratio,
    placement,
    onChange,
    onRatioChange,
}: {
    step: SignStep;
    url: string;
    ratio: number;
    placement: Placement;
    onChange: (placement: Placement) => void;
    onRatioChange: (ratio: number) => void;
}) {
    const area = useRef<HTMLDivElement>(null);
    const gesture = useRef<Gesture | null>(null);
    const measured = useImageRatio(onRatioChange);

    const update = (next: Placement) =>
        onChange(clampPlacement(step, next, ratio));

    /** The box's rectangle and the signature centre, in screen pixels. */
    const measure = () => {
        const rect = area.current!.getBoundingClientRect();

        return {
            rect,
            centerX: rect.left + placement.x * rect.width,
            centerY: rect.top + placement.y * rect.height,
        };
    };

    const start =
        (kind: Gesture['kind']) => (event: ReactPointerEvent<HTMLElement>) => {
            if (event.button !== 0) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);

            const { centerX, centerY } = measure();

            gesture.current =
                kind === 'move'
                    ? {
                          kind,
                          startX: event.clientX,
                          startY: event.clientY,
                          from: placement,
                      }
                    : kind === 'resize'
                      ? {
                            kind,
                            startDistance: Math.max(
                                1,
                                Math.hypot(
                                    event.clientX - centerX,
                                    event.clientY - centerY,
                                ),
                            ),
                            from: placement,
                        }
                      : { kind };
        };

    const move = (event: ReactPointerEvent<HTMLElement>) => {
        const current = gesture.current;

        if (!current) {
            return;
        }

        const { rect, centerX, centerY } = measure();

        if (current.kind === 'move') {
            update({
                ...current.from,
                x:
                    current.from.x +
                    (event.clientX - current.startX) / rect.width,
                y:
                    current.from.y +
                    (event.clientY - current.startY) / rect.height,
            });
        } else if (current.kind === 'resize') {
            const distance = Math.hypot(
                event.clientX - centerX,
                event.clientY - centerY,
            );

            update({
                ...current.from,
                width: (current.from.width * distance) / current.startDistance,
            });
        } else {
            // The handle sits above the centre: straight up is no tilt.
            const angle =
                (Math.atan2(event.clientY - centerY, event.clientX - centerX) *
                    180) /
                    Math.PI +
                90;

            update({ ...placement, rotation: angle });
        }
    };

    const end = () => {
        gesture.current = null;
    };

    /** A click on an empty part of the box moves the signature there. */
    const placeAt = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0 || event.target !== event.currentTarget) {
            return;
        }

        const { rect } = measure();

        update({
            ...placement,
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height,
        });
    };

    const keyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
        const nudge = event.shiftKey ? 0.05 : 0.01;
        const changes: Record<string, Partial<Placement>> = {
            ArrowLeft: { x: placement.x - nudge },
            ArrowRight: { x: placement.x + nudge },
            ArrowUp: { y: placement.y - nudge },
            ArrowDown: { y: placement.y + nudge },
            '+': { width: placement.width + 0.05 },
            '=': { width: placement.width + 0.05 },
            '-': { width: placement.width - 0.05 },
            '[': { rotation: placement.rotation - 2 },
            ']': { rotation: placement.rotation + 2 },
        };
        const change = changes[event.key];

        if (change) {
            event.preventDefault();
            update({ ...placement, ...change });
        }
    };

    return (
        <div
            ref={area}
            className="absolute inset-0 cursor-crosshair touch-none"
            onPointerDown={placeAt}
        >
            <div
                role="group"
                tabIndex={0}
                aria-label="Your signature. Drag to move it; arrow keys move it, plus and minus resize it, brackets tilt it."
                className="absolute cursor-move rounded-[2px] outline-2 outline-offset-2 outline-sky-500 outline-dashed focus-visible:outline-solid"
                style={signatureStyle(step, placement, ratio)}
                onPointerDown={start('move')}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={keyboard}
            >
                <img
                    src={url}
                    alt=""
                    {...guardImage}
                    {...measured}
                    className="pointer-events-none size-full object-contain select-none"
                />
                {CORNERS.map((position) => (
                    <span
                        key={position}
                        aria-hidden
                        className={cn(
                            'absolute size-2.5 rounded-full border border-sky-600 bg-white',
                            position,
                        )}
                        onPointerDown={start('resize')}
                        onPointerMove={move}
                        onPointerUp={end}
                        onPointerCancel={end}
                    />
                ))}
                <span
                    aria-hidden
                    className="absolute -top-6 left-1/2 flex size-4 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-sky-600 bg-white text-sky-700"
                    onPointerDown={start('rotate')}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                >
                    <RotateCw className="size-2.5" />
                </span>
            </div>
        </div>
    );
}
