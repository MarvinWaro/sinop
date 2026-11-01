import '@fontsource/allura/400.css';
import '@fontsource/great-vibes/400.css';
import '@fontsource/sacramento/400.css';
import { Check, Eraser, ImageUp, PenLine, Type, Undo2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import SignaturePad from 'signature_pad';
import InputError from '@/components/input-error';
import { guardImage } from '@/components/signature/signature-box';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { NewSignature } from '@/hooks/use-signature-library';
import {
    canvasFromFile,
    extractInk,
    INK_COLORS,
    renderTyped,
    toPngBlob,
    trimToInk,
} from '@/lib/signature-image';
import type { InkColor } from '@/lib/signature-image';
import { cn } from '@/lib/utils';
import type { UserSignature } from '@/types';

type Source = UserSignature['source'];

const SOURCES: { value: Source; label: string; icon: typeof PenLine }[] = [
    { value: 'drawn', label: 'Draw', icon: PenLine },
    { value: 'typed', label: 'Type', icon: Type },
    { value: 'uploaded', label: 'Upload', icon: ImageUp },
];

const DEFAULT_NAMES: Record<Source, string> = {
    drawn: 'Drawn signature',
    typed: 'Typed signature',
    uploaded: 'Uploaded signature',
};

const FONTS = ['Great Vibes', 'Allura', 'Sacramento'] as const;

/** Photos straight from a phone are fine; they are scaled down here. */
const MAX_UPLOAD_MB = 10;

/** A checkerboard, so a transparent background shows as transparent. */
const checkerboard =
    'bg-[conic-gradient(#f1f1f1_25%,#fff_0_50%,#f1f1f1_0_75%,#fff_0)] bg-[length:16px_16px]';

/**
 * Create a signature on the spot: draw it, type it in a handwriting font, or
 * upload a picture (the paper is removed). It is saved to the person's
 * signatures as a transparent PNG. Loaded only when opened (React.lazy),
 * with the drawing pad and fonts.
 */
export default function SignatureCreatorDialog({
    open,
    onOpenChange,
    onCreate,
    typedName = '',
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (signature: NewSignature) => Promise<unknown>;
    /** Suggested text for "Type" (the person's name). */
    typedName?: string;
}) {
    const nameId = useId();
    const [source, setSource] = useState<Source>('drawn');
    const [ink, setInk] = useState<InkColor>('black');
    const [name, setName] = useState('');
    const [makeDefault, setMakeDefault] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    /** Gives the finished picture of the current tab (null: nothing yet). */
    const produce = useRef<() => Promise<HTMLCanvasElement | null>>(
        async () => null,
    );

    const save = async () => {
        setSaving(true);
        setError(null);

        try {
            const picture = await produce.current();
            const trimmed = picture ? trimToInk(picture) : null;

            if (!trimmed) {
                setError('There is no signature to save yet.');

                return;
            }

            await onCreate({
                file: await toPngBlob(trimmed),
                name: name.trim() || DEFAULT_NAMES[source],
                source,
                makeDefault,
            });
            onOpenChange(false);
        } catch (failure) {
            setError(
                failure instanceof Error
                    ? failure.message
                    : 'Could not save the signature.',
            );
        } finally {
            setSaving(false);
        }
    };

    const panel = {
        produce,
        ink,
        onReadyChange: setReady,
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>New signature</DialogTitle>
                    <DialogDescription>
                        Create it once and use it on any requisition.
                    </DialogDescription>
                </DialogHeader>

                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={source}
                    onValueChange={(value: string) => {
                        if (value) {
                            setSource(value as Source);
                            setReady(false);
                            setError(null);
                        }
                    }}
                    className="w-full"
                >
                    {SOURCES.map(({ value, label, icon: Icon }) => (
                        <ToggleGroupItem
                            key={value}
                            value={value}
                            className="flex-1 gap-2"
                        >
                            <Icon className="size-4" />
                            {label}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>

                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                    <div className="min-w-0">
                        {source === 'drawn' && <DrawPanel {...panel} />}
                        {source === 'typed' && (
                            <TypePanel {...panel} initialText={typedName} />
                        )}
                        {source === 'uploaded' && <UploadPanel {...panel} />}
                    </div>
                    <InkPicker
                        value={ink}
                        onChange={setInk}
                        note={
                            source === 'uploaded'
                                ? 'Used when the background is removed.'
                                : undefined
                        }
                    />
                </div>

                <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="grid gap-1.5">
                        <Label htmlFor={nameId}>Name</Label>
                        <Input
                            id={nameId}
                            value={name}
                            maxLength={60}
                            placeholder={DEFAULT_NAMES[source]}
                            onChange={(event) => setName(event.target.value)}
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm sm:pb-2">
                        <Checkbox
                            checked={makeDefault}
                            onCheckedChange={(checked) =>
                                setMakeDefault(checked === true)
                            }
                        />
                        Make default
                    </label>
                </div>

                <InputError message={error ?? undefined} />

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={save}
                        disabled={!ready || saving}
                    >
                        {saving ? <Spinner /> : <Check />}
                        Use signature
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type PanelProps = {
    produce: RefObject<() => Promise<HTMLCanvasElement | null>>;
    ink: InkColor;
    onReadyChange: (ready: boolean) => void;
};

function InkPicker({
    value,
    onChange,
    note,
}: {
    value: InkColor;
    onChange: (ink: InkColor) => void;
    note?: string;
}) {
    return (
        <div className="grid content-start gap-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Ink colour
            </p>
            <ToggleGroup
                type="single"
                variant="outline"
                value={value}
                onValueChange={(ink: string) =>
                    ink && onChange(ink as InkColor)
                }
                className="w-full sm:flex-col sm:items-stretch"
            >
                {(Object.keys(INK_COLORS) as InkColor[]).map((ink) => (
                    <ToggleGroupItem
                        key={ink}
                        value={ink}
                        className="flex-1 justify-start gap-2 capitalize"
                    >
                        <span
                            className="size-3 rounded-full"
                            style={{ background: INK_COLORS[ink] }}
                        />
                        {ink}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
    );
}

function DrawPanel({ produce, ink, onReadyChange }: PanelProps) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const pad = useRef<SignaturePad | null>(null);

    useEffect(() => {
        const element = canvas.current!;
        const signaturePad = new SignaturePad(element, {
            penColor: INK_COLORS.black,
            minWidth: 0.8,
            maxWidth: 2.8,
        });
        pad.current = signaturePad;

        // Sharp on high-density screens; strokes survive a resize.
        const fit = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const strokes = signaturePad.toData();
            element.width = element.offsetWidth * ratio;
            element.height = element.offsetHeight * ratio;
            element.getContext('2d')!.scale(ratio, ratio);
            signaturePad.fromData(strokes);
        };
        const changed = () => onReadyChange(!signaturePad.isEmpty());

        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(element);
        signaturePad.addEventListener('endStroke', changed);
        produce.current = async () => (signaturePad.isEmpty() ? null : element);

        return () => {
            observer.disconnect();
            signaturePad.removeEventListener('endStroke', changed);
            signaturePad.off();
            pad.current = null;
        };
    }, [produce, onReadyChange]);

    // A new colour repaints what is already drawn.
    useEffect(() => {
        const signaturePad = pad.current;

        if (!signaturePad) {
            return;
        }

        signaturePad.penColor = INK_COLORS[ink];
        signaturePad.fromData(
            signaturePad
                .toData()
                .map((stroke) => ({ ...stroke, penColor: INK_COLORS[ink] })),
        );
    }, [ink]);

    const undo = () => {
        const signaturePad = pad.current;

        if (signaturePad) {
            signaturePad.fromData(signaturePad.toData().slice(0, -1));
            onReadyChange(!signaturePad.isEmpty());
        }
    };

    const clear = () => {
        pad.current?.clear();
        onReadyChange(false);
    };

    return (
        <div className="grid gap-2">
            <canvas
                ref={canvas}
                aria-label="Signature drawing area"
                className="h-48 w-full touch-none rounded-md border bg-white"
            />
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Sign with your mouse, finger or stylus.</span>
                <span className="flex gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={undo}
                    >
                        <Undo2 />
                        Undo
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clear}
                    >
                        <Eraser />
                        Clear
                    </Button>
                </span>
            </div>
        </div>
    );
}

function TypePanel({
    produce,
    ink,
    onReadyChange,
    initialText,
}: PanelProps & { initialText: string }) {
    const inputId = useId();
    const [text, setText] = useState(initialText);
    const [font, setFont] = useState<(typeof FONTS)[number]>(FONTS[0]);

    useEffect(() => {
        onReadyChange(text.trim() !== '');
        produce.current = async () =>
            text.trim() ? renderTyped(text.trim(), font, ink) : null;
    }, [text, font, ink, produce, onReadyChange]);

    return (
        <div className="grid gap-3">
            <div className="grid gap-1.5">
                <Label htmlFor={inputId}>Your name</Label>
                <Input
                    id={inputId}
                    value={text}
                    maxLength={60}
                    onChange={(event) => setText(event.target.value)}
                />
            </div>
            <div role="radiogroup" aria-label="Style" className="grid gap-2">
                {FONTS.map((family) => (
                    <button
                        key={family}
                        type="button"
                        role="radio"
                        aria-checked={font === family}
                        onClick={() => setFont(family)}
                        className={cn(
                            'truncate rounded-md border bg-white px-4 py-1 text-left text-3xl leading-normal',
                            font === family
                                ? 'border-primary ring-2 ring-primary/30'
                                : 'hover:border-foreground/30',
                        )}
                        style={{
                            fontFamily: `"${family}"`,
                            color: INK_COLORS[ink],
                        }}
                    >
                        {text.trim() || 'Your name'}
                    </button>
                ))}
            </div>
        </div>
    );
}

function UploadPanel({ produce, ink, onReadyChange }: PanelProps) {
    const inputId = useId();
    const [source, setSource] = useState<HTMLCanvasElement | null>(null);
    const [removeBackground, setRemoveBackground] = useState(true);
    const [recolour, setRecolour] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const choose = async (file: File | undefined) => {
        setError(null);

        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError('Choose a picture (PNG, JPG, WebP…).');

            return;
        }

        if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
            setError(`Choose a picture under ${MAX_UPLOAD_MB} MB.`);

            return;
        }

        try {
            setSource(await canvasFromFile(file));
        } catch {
            setError('This picture could not be opened.');
        }
    };

    // Cleaned again whenever an option changes; a signature-sized picture
    // takes a few milliseconds.
    useEffect(() => {
        if (!source) {
            onReadyChange(false);
            setPreview(null);

            return;
        }

        const result = extractInk(source, {
            removeBackground,
            ink: removeBackground && recolour ? ink : null,
        });
        const trimmed = trimToInk(result);

        setPreview(trimmed ? trimmed.toDataURL('image/png') : null);
        onReadyChange(trimmed !== null);
        produce.current = async () => result;
    }, [source, removeBackground, recolour, ink, produce, onReadyChange]);

    return (
        <div className="grid gap-3">
            <div className="grid gap-1.5">
                <Label htmlFor={inputId}>Picture of your signature</Label>
                <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    onChange={(event) => choose(event.target.files?.[0])}
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                />
                <p className="text-xs text-muted-foreground">
                    Sign on white paper and take a clear photo, or upload a
                    scan. The paper is removed for you.
                </p>
                <InputError message={error ?? undefined} />
            </div>

            <div
                className={cn(
                    'flex h-32 items-center justify-center rounded-md border p-3',
                    checkerboard,
                )}
            >
                {preview ? (
                    <img
                        src={preview}
                        alt="Your signature, cleaned"
                        {...guardImage}
                        className="max-h-full max-w-full object-contain"
                    />
                ) : (
                    <span className="text-sm text-neutral-500">
                        The cleaned signature shows here.
                    </span>
                )}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <label className="flex items-center gap-2">
                    <Checkbox
                        checked={removeBackground}
                        onCheckedChange={(checked) =>
                            setRemoveBackground(checked === true)
                        }
                    />
                    Remove background
                </label>
                <label className="flex items-center gap-2">
                    <Checkbox
                        checked={recolour}
                        disabled={!removeBackground}
                        onCheckedChange={(checked) =>
                            setRecolour(checked === true)
                        }
                    />
                    Use the ink colour
                </label>
            </div>
        </div>
    );
}
