import { Download, Printer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { scan } from '@/routes/property';

/**
 * The property sticker: 3 × 2 in, landscape. CHED header, the item name,
 * the property number in large type and the serial number, with a QR code
 * that opens the property's page (public basics, full details when signed
 * in). One SVG serves the preview, printing and the PNG, so all three match.
 *
 * Coordinates are in hundredths of an inch (viewBox 300 × 200).
 */

const WIDTH = 300;
const HEIGHT = 200;
const QR_SIZE = 96;
const QR_X = 192;
const QR_Y = 54;
const TEXT_X = 12;
const TEXT_WIDTH = 172;
const SANS = 'Arial, Helvetica, sans-serif';
const MONO = '"Courier New", Consolas, monospace';

/** The page a sticker's QR opens, as a full link (the site's own address). */
export function scanLink(propertyNumber: string): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;

    return `${origin}${scan.url(propertyNumber.trim().toUpperCase())}`;
}

type QrModule = typeof import('qrcode');
let qrLibrary: Promise<QrModule> | null = null;

/** The QR as one SVG path in module units, or null while loading. */
function useQrPath(text: string | null): { path: string; size: number } | null {
    const [qr, setQr] = useState<{
        text: string;
        path: string;
        size: number;
    } | null>(null);

    useEffect(() => {
        if (!text) {
            return;
        }

        let active = true;

        // Loaded on first use: only property pages need it.
        qrLibrary ??= import('qrcode');
        void qrLibrary.then((QRCode) => {
            const { modules } = QRCode.create(text, {
                errorCorrectionLevel: 'M',
            });
            let path = '';

            for (let row = 0; row < modules.size; row++) {
                for (let col = 0; col < modules.size; col++) {
                    if (modules.get(row, col)) {
                        path += `M${col} ${row}h1v1h-1z`;
                    }
                }
            }

            if (active) {
                setQr({ text, path, size: modules.size });
            }
        });

        return () => {
            active = false;
        };
    }, [text]);

    return text && qr?.text === text ? qr : null;
}

/** The logo as a data URL, so it survives into the saved PNG. */
function useLogoDataUrl(src: string): string {
    const [dataUrl, setDataUrl] = useState(src);

    useEffect(() => {
        let active = true;

        fetch(src)
            .then((response) => response.blob())
            .then(
                (blob) =>
                    new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () =>
                            resolve(
                                typeof reader.result === 'string'
                                    ? reader.result
                                    : src,
                            );
                        reader.readAsDataURL(blob);
                    }),
            )
            .then((url) => active && setDataUrl(url))
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [src]);

    return dataUrl;
}

/** Splits a name into at most two lines of about `width` characters. */
function twoLines(text: string, width: number): string[] {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [''];

    for (const word of words) {
        const current = lines[lines.length - 1];

        if (!current || `${current} ${word}`.length <= width) {
            lines[lines.length - 1] = current ? `${current} ${word}` : word;
        } else if (lines.length < 2) {
            lines.push(word);
        } else {
            lines[1] = `${lines[1]} ${word}`;
        }
    }

    return lines.map((line) =>
        line.length > width ? `${line.slice(0, width - 1).trimEnd()}…` : line,
    );
}

export function PropertySticker({
    itemName,
    propertyNumber,
    serialNo,
    scanUrl,
    svgRef,
    className,
}: {
    itemName: string;
    propertyNumber: string;
    serialNo?: string | null;
    /** What the QR opens; none yet (no property number) shows a blank. */
    scanUrl: string | null;
    svgRef?: Ref<SVGSVGElement>;
    className?: string;
}) {
    const qr = useQrPath(scanUrl);
    const logo = useLogoDataUrl('/img/ched-logo.png');
    const name = itemName.trim();
    const number = propertyNumber.trim().toUpperCase();
    const nameLines = name ? twoLines(name, 26) : ['Item name'];
    // Monospace is about 0.6 em per character: shrink long numbers to fit.
    const numberSize = Math.max(
        8,
        Math.min(17, TEXT_WIDTH / (Math.max(number.length, 1) * 0.62)),
    );
    const muted = '#6b7280';
    const placeholder = '#a1a1aa';

    return (
        <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            width="3in"
            height="2in"
            role="img"
            aria-label={`Property sticker for ${name || 'a new item'}${number ? `, property number ${number}` : ''}`}
            className={cn('h-auto w-full', className)}
        >
            <rect width={WIDTH} height={HEIGHT} fill="#ffffff" />
            <rect
                x="3"
                y="3"
                width={WIDTH - 6}
                height={HEIGHT - 6}
                rx="7"
                fill="none"
                stroke="#d4d4d8"
                strokeWidth="1"
            />

            <image href={logo} x="12" y="11" width="27" height="27" />
            <text
                x="45"
                y="23"
                fontFamily={SANS}
                fontSize="8.4"
                fontWeight="700"
                fill="#111827"
            >
                COMMISSION ON HIGHER EDUCATION
            </text>
            <text x="45" y="34" fontFamily={SANS} fontSize="7" fill={muted}>
                Regional Office XII · Government Property
            </text>
            <line x1="12" x2="288" y1="45" y2="45" stroke="#e4e4e7" />

            <text
                x={TEXT_X}
                y="61"
                fontFamily={SANS}
                fontSize="6.2"
                letterSpacing="0.6"
                fill={muted}
            >
                ITEM
            </text>
            {nameLines.map((line, index) => (
                <text
                    key={index}
                    x={TEXT_X}
                    y={75 + index * 13}
                    fontFamily={SANS}
                    fontSize="11"
                    fontWeight="700"
                    fill={name ? '#111827' : placeholder}
                >
                    {line}
                </text>
            ))}

            <text
                x={TEXT_X}
                y="111"
                fontFamily={SANS}
                fontSize="6.2"
                letterSpacing="0.6"
                fill={muted}
            >
                PROPERTY NO.
            </text>
            <text
                x={TEXT_X}
                y={113 + numberSize}
                fontFamily={MONO}
                fontSize={numberSize}
                fontWeight="700"
                fill={number ? '#111827' : placeholder}
            >
                {number || '—'}
            </text>

            {serialNo?.trim() && (
                <text
                    x={TEXT_X}
                    y="150"
                    fontFamily={SANS}
                    fontSize="7.2"
                    fill="#374151"
                >
                    S/N {serialNo.trim()}
                </text>
            )}

            <rect
                x={QR_X - 3}
                y={QR_Y - 3}
                width={QR_SIZE + 6}
                height={QR_SIZE + 6}
                fill="#ffffff"
            />
            {qr ? (
                <path
                    d={qr.path}
                    fill="#111827"
                    transform={`translate(${QR_X} ${QR_Y}) scale(${QR_SIZE / qr.size})`}
                    shapeRendering="crispEdges"
                />
            ) : (
                <rect
                    x={QR_X}
                    y={QR_Y}
                    width={QR_SIZE}
                    height={QR_SIZE}
                    fill="#f4f4f5"
                    stroke="#e4e4e7"
                    strokeDasharray="3 3"
                />
            )}
            <text
                x={QR_X + QR_SIZE / 2}
                y="164"
                fontFamily={SANS}
                fontSize="6.4"
                textAnchor="middle"
                fill={muted}
            >
                Scan for details
            </text>

            <line x1="12" x2="288" y1="174" y2="174" stroke="#e4e4e7" />
            <text
                x={TEXT_X}
                y="187"
                fontFamily={SANS}
                fontSize="6.4"
                fill={muted}
            >
                Property of the Government. Please do not remove this sticker.
            </text>
        </svg>
    );
}

/** The sticker's SVG as markup, ready to print or draw. */
function markupOf(svg: SVGSVGElement): string {
    return new XMLSerializer().serializeToString(svg);
}

/** Prints the sticker alone, at its real size, through a hidden frame. */
function printSticker(svg: SVGSVGElement, title: string): void {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const doc = frame.contentDocument!;
    doc.open();
    doc.write(
        `<!doctype html><html><head><title>${title}</title><style>@page{size:3in 2in;margin:0}html,body{margin:0;padding:0}svg{display:block;width:3in;height:2in}</style></head><body>${markupOf(svg)}</body></html>`,
    );
    doc.close();

    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    // The dialog blocks until closed; give the browser a moment, then tidy up.
    setTimeout(() => frame.remove(), 1000);
}

/** Saves the sticker as a 300 dpi PNG (900 × 600 px). */
function saveStickerPng(svg: SVGSVGElement, fileName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 900;
            canvas.height = 600;
            const context = canvas.getContext('2d');

            if (!context) {
                reject(new Error('This browser cannot draw images.'));

                return;
            }

            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Could not save the sticker.'));

                    return;
                }

                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 1000);
                resolve();
            }, 'image/png');
        };
        image.onerror = () => reject(new Error('Could not save the sticker.'));
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markupOf(svg))}`;
    });
}

/**
 * The sticker with Print and Save PNG, as a card. Disabled until the item
 * name and property number are filled in.
 */
export function PropertyStickerCard({
    itemName,
    propertyNumber,
    serialNo,
    note,
    actions,
    className,
}: {
    itemName: string;
    propertyNumber: string;
    serialNo?: string | null;
    note?: ReactNode;
    /** More buttons beside Print and Save PNG. */
    actions?: ReactNode;
    className?: string;
}) {
    const svg = useRef<SVGSVGElement>(null);
    const number = propertyNumber.trim().toUpperCase();
    const ready = itemName.trim() !== '' && number !== '';
    const scanUrl = number ? scanLink(number) : null;
    const fileName = `sticker-${number.replace(/[^A-Z0-9-]+/g, '-') || 'property'}.png`;

    return (
        <Card className={cn('h-fit', className)}>
            <CardHeader>
                <CardTitle>Property sticker</CardTitle>
                <CardDescription>
                    3 × 2 in. Prints at actual size; the QR opens this
                    property&apos;s details.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
                <div className="overflow-hidden rounded-lg border bg-muted/40 p-3">
                    <PropertySticker
                        svgRef={svg}
                        itemName={itemName}
                        propertyNumber={number}
                        serialNo={serialNo}
                        scanUrl={scanUrl}
                        className="rounded-md shadow-sm"
                    />
                </div>
                {note && (
                    <p className="text-xs text-muted-foreground">{note}</p>
                )}
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        disabled={!ready}
                        onClick={() =>
                            svg.current &&
                            printSticker(svg.current, `Sticker ${number}`)
                        }
                    >
                        <Printer />
                        Print
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!ready}
                        onClick={() =>
                            svg.current && saveStickerPng(svg.current, fileName)
                        }
                    >
                        <Download />
                        Save PNG
                    </Button>
                    {actions}
                </div>
            </CardContent>
        </Card>
    );
}
