/**
 * Turns a drawn, typed or uploaded signature into what the system keeps:
 * the ink alone on a transparent background, trimmed to its edges, as a PNG.
 * The same rule as App\Support\SignatureInk (which cleans old uploads).
 * Plain canvas work, no library: a signature is dark ink on light paper.
 */

export type InkColor = 'black' | 'blue';

export const INK_COLORS: Record<InkColor, string> = {
    black: '#111111',
    blue: '#1a3a9c',
};

/** Darkness below this (0–255, against the paper) is paper… */
const LOW = 28;
/** …above this is solid ink; in between fades. */
const HIGH = 110;

/** Longest side kept: plenty for a form, small to store. */
export const MAX_SIDE = 1200;

const PADDING = 8;

function canvasOf(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));

    return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
        throw new Error('This browser cannot edit images.');
    }

    return ctx;
}

function hexToRgb(hex: string): [number, number, number] {
    const value = Number.parseInt(hex.slice(1), 16);

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

const luminance = (r: number, g: number, b: number) =>
    0.299 * r + 0.587 * g + 0.114 * b;

/** An image file drawn on a canvas, scaled down to MAX_SIDE. */
export async function canvasFromFile(file: File): Promise<HTMLCanvasElement> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = canvasOf(bitmap.width * scale, bitmap.height * scale);

    context(canvas).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return canvas;
}

/** About 400 points around the border: where the paper shows. */
function edgeIndexes(width: number, height: number): number[] {
    const indexes: number[] = [];
    const stepX = Math.max(1, Math.floor(width / 100));
    const stepY = Math.max(1, Math.floor(height / 100));

    for (let x = 0; x < width; x += stepX) {
        indexes.push(x, (height - 1) * width + x);
    }

    for (let y = 0; y < height; y += stepY) {
        indexes.push(y * width, y * width + width - 1);
    }

    return indexes;
}

const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

/**
 * The ink of a picture. With `removeBackground`, the paper (the median
 * colour of the edges) becomes transparent and the ink keeps its own colour
 * without the paper mixed into its edges; light ink on dark paper is turned
 * dark. `ink` recolours every stroke (not when the paper is kept).
 * Pictures that are already transparent keep their background.
 */
export function extractInk(
    source: HTMLCanvasElement,
    {
        removeBackground = true,
        ink = null,
    }: { removeBackground?: boolean; ink?: InkColor | null } = {},
): HTMLCanvasElement {
    const { width, height } = source;
    const out = canvasOf(width, height);
    const ctx = context(out);
    ctx.drawImage(source, 0, 0);

    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const edges = edgeIndexes(width, height);
    const transparentEdges =
        edges.filter((index) => data[index * 4 + 3] < 30).length >
        edges.length / 2;
    const recolour = ink ? hexToRgb(INK_COLORS[ink]) : null;

    if (removeBackground && !transparentEdges) {
        const paper = [0, 1, 2].map((channel) =>
            median(edges.map((index) => data[index * 4 + channel])),
        ) as [number, number, number];
        const paperLight = luminance(...paper);
        const darkPaper = paperLight < 110;
        const dark = recolour ?? hexToRgb(INK_COLORS.black);

        for (let i = 0; i < data.length; i += 4) {
            const light = luminance(data[i], data[i + 1], data[i + 2]);
            const contrast = darkPaper
                ? light - paperLight
                : paperLight - light;
            const alpha = Math.min(
                1,
                Math.max(0, (contrast - LOW) / (HIGH - LOW)),
            );

            if (alpha <= 0) {
                data[i + 3] = 0;
                continue;
            }

            for (let c = 0; c < 3; c++) {
                data[i + c] =
                    recolour || darkPaper
                        ? dark[c]
                        : Math.min(
                              255,
                              Math.max(
                                  0,
                                  (data[i + c] - (1 - alpha) * paper[c]) /
                                      alpha,
                              ),
                          );
            }

            data[i + 3] = Math.round(alpha * 255);
        }
    } else if (recolour && transparentEdges) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = recolour[0];
            data[i + 1] = recolour[1];
            data[i + 2] = recolour[2];
        }
    }

    ctx.putImageData(image, 0, 0);

    return out;
}

/**
 * The picture cut to its ink, with a little padding, and scaled down to
 * MAX_SIDE. Null when there is no ink at all.
 */
export function trimToInk(source: HTMLCanvasElement): HTMLCanvasElement | null {
    const { width, height } = source;
    const data = context(source).getImageData(0, 0, width, height).data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 64) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (maxX < 0) {
        return null;
    }

    const left = Math.max(0, minX - PADDING);
    const top = Math.max(0, minY - PADDING);
    const cropW = Math.min(width, maxX + PADDING + 1) - left;
    const cropH = Math.min(height, maxY + PADDING + 1) - top;
    const scale = Math.min(1, MAX_SIDE / Math.max(cropW, cropH));
    const out = canvasOf(cropW * scale, cropH * scale);

    context(out).drawImage(
        source,
        left,
        top,
        cropW,
        cropH,
        0,
        0,
        out.width,
        out.height,
    );

    return out;
}

/** A typed name written in a handwriting font, ready for trimToInk. */
export async function renderTyped(
    text: string,
    fontFamily: string,
    ink: InkColor,
): Promise<HTMLCanvasElement> {
    const size = 120;
    const font = `${size}px "${fontFamily}"`;

    // The font file is only fetched once something uses it.
    await document.fonts.load(font, text);

    const measure = context(canvasOf(1, 1));
    measure.font = font;
    const width = measure.measureText(text).width;
    const canvas = canvasOf(width + size, size * 1.8);
    const ctx = context(canvas);

    ctx.font = font;
    ctx.fillStyle = INK_COLORS[ink];
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, canvas.height / 2);

    return canvas;
}

export function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) =>
        canvas.toBlob(
            (blob) =>
                blob ? resolve(blob) : reject(new Error('Could not save.')),
            'image/png',
        ),
    );
}
