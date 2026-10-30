import type { Placement, SignStep } from '@/types';

/**
 * The RIS form's columns A–H in pixels and the signature boxes, as the Excel
 * export lays them out (mirrors App\Support\RisSignatureBox). A placement is
 * kept as fractions of its box, so the preview, the RIS page and the Excel
 * file put a signature in the same spot at any size.
 */
export const FORM_COLUMNS = [84, 70, 210, 70, 70, 70, 70, 126] as const;

export const BOX_HEIGHT = 67;

export const SIGN_STEPS: SignStep[] = [
    'requested',
    'approved',
    'issued',
    'received',
];

export const SIGN_STEP_LABELS: Record<SignStep, string> = {
    requested: 'Requested by',
    approved: 'Approved by',
    issued: 'Issued by',
    received: 'Received by',
};

/** First column (0 = A) and how many columns each box spans. */
export const SIGNATURE_BOXES: Record<
    SignStep,
    { start: number; span: number }
> = {
    requested: { start: 2, span: 1 },
    approved: { start: 3, span: 2 },
    issued: { start: 5, span: 2 },
    received: { start: 7, span: 1 },
};

export const PLACEMENT_LIMITS = {
    minWidth: 0.1,
    maxRotation: 30,
} as const;

/** Width of a box in pixels. */
export function boxWidth(step: SignStep): number {
    const { start, span } = SIGNATURE_BOXES[step];

    return FORM_COLUMNS.slice(start, start + span).reduce(
        (sum, width) => sum + width,
        0,
    );
}

/** Width ÷ height of a box, for CSS aspect-ratio. */
export function boxAspect(step: SignStep): number {
    return boxWidth(step) / BOX_HEIGHT;
}

export type Frame = {
    left: number;
    top: number;
    width: number;
    height: number;
};

/**
 * The signature's rectangle before rotation, as fractions of the box: the
 * stored width, kept to the image's proportions (`ratio` = height ÷ width)
 * and never taller than the box. Same rule as RisSignatureBox::frame.
 */
export function frameOf(
    step: SignStep,
    placement: Placement,
    ratio: number,
): Frame {
    const boxW = boxWidth(step);
    const widthPx = Math.min(placement.width * boxW, BOX_HEIGHT / ratio);
    const heightPx = widthPx * ratio;

    return {
        left: placement.x - widthPx / boxW / 2,
        top: placement.y - heightPx / BOX_HEIGHT / 2,
        width: widthPx / boxW,
        height: heightPx / BOX_HEIGHT,
    };
}

/**
 * Where a signature starts: centred, about 60% of the box tall, and never
 * wider than 90% of the box (long typed names).
 */
export function defaultPlacement(step: SignStep, ratio: number): Placement {
    const width = Math.min(0.9, (0.6 * BOX_HEIGHT) / ratio / boxWidth(step));

    return clampPlacement(step, { x: 0.5, y: 0.5, width, rotation: 0 }, ratio);
}

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

/**
 * Keeps a placement valid: a sensible size, a small tilt, and the
 * signature's rectangle inside the box.
 */
export function clampPlacement(
    step: SignStep,
    placement: Placement,
    ratio: number,
): Placement {
    // Never wider than the box, nor than the box height allows.
    const maxWidth = Math.min(1, BOX_HEIGHT / ratio / boxWidth(step));
    const width = clamp(
        placement.width,
        Math.min(PLACEMENT_LIMITS.minWidth, maxWidth),
        maxWidth,
    );
    const frame = frameOf(step, { ...placement, width }, ratio);
    const halfW = frame.width / 2;
    const halfH = frame.height / 2;

    return {
        x: round(clamp(placement.x, halfW, 1 - halfW), 4),
        y: round(clamp(placement.y, halfH, 1 - halfH), 4),
        width: round(width, 4),
        rotation: round(
            clamp(
                placement.rotation,
                -PLACEMENT_LIMITS.maxRotation,
                PLACEMENT_LIMITS.maxRotation,
            ),
            1,
        ),
    };
}

function round(value: number, digits: number): number {
    const factor = 10 ** digits;

    return Math.round(value * factor) / factor;
}
