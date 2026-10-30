import {
    Archive,
    Award,
    Bath,
    Battery,
    Brush,
    Calculator,
    Disc,
    Droplets,
    Eraser,
    FileText,
    Folder,
    Hand,
    Highlighter,
    IdCard,
    Lightbulb,
    Mail,
    NotebookPen,
    Package,
    PaintBucket,
    Paperclip,
    Pen,
    Pencil,
    Printer,
    Ruler,
    Scissors,
    Sparkles,
    SprayCan,
    Stamp,
    StickyNote,
    Trash2,
    Usb,
    Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { badgeTone } from '@/components/status-badges';
import { cn } from '@/lib/utils';

/**
 * How a supply looks without a photo: an icon picked from its name (or its
 * category) on a tile tinted by category. Category tints stay clear of the
 * green / amber / red used for stock levels.
 */
export type SupplyCategoryKey = 'office' | 'cleaning' | 'maintenance' | 'other';

export type SupplyVisual = {
    icon: LucideIcon;
    category: SupplyCategoryKey;
};

// Checked in order, so more specific words come first ("MARKER INK" is a
// marker, "STAMP PAD INK" a stamp, before plain "INK").
const keywordIcons: [string[], LucideIcon][] = [
    [['HIGHLIGHTER', 'MARKER'], Highlighter],
    [['STAMP', 'SEAL', 'DATER'], Stamp],
    [['INK', 'RIBBON', 'CARTRIDGE', 'TONER'], Printer],
    [['CORRECTION', 'ERASER'], Eraser],
    [['PENCIL', 'SHARPENER'], Pencil],
    [['PEN'], Pen],
    [['RULER'], Ruler],
    [['SCISSORS', 'CUTTER'], Scissors],
    [
        [
            'CLIP',
            'FASTENER',
            'BINDING',
            'RUBBER BAND',
            'STAPLE',
            'PUNCHER',
            'GLUE',
            'TAPE',
            'TWINE',
        ],
        Paperclip,
    ],
    [['CALCULATOR'], Calculator],
    [['BATTERY'], Battery],
    [['BULB', 'SOCKET'], Lightbulb],
    [['ENVELOPE'], Mail],
    [['CERTIFICATE'], Award],
    [['ID HOLDER'], IdCard],
    [['FOLDER', 'FILER', 'INDEX TAB', 'CLEARBOOK', 'PVC COVER'], Folder],
    [['BOX', 'TRAY', 'ORGANIZER'], Archive],
    [['NOTEBOOK', 'RECORD BOOK'], NotebookPen],
    [['STICKY'], StickyNote],
    [['FLASH DRIVE', 'USB'], Usb],
    [['CD-', 'DVD'], Disc],
    [
        [
            'SAND PAPER',
            'VALVE',
            'FAUCET',
            'KNOB',
            'HOSE',
            'TEFLON',
            'SOLVENT',
            'TROWEL',
            'TOILET PUMP',
            'TOILET FLUSH',
        ],
        Wrench,
    ],
    [['TISSUE', 'TOILET', 'BIDET'], Bath],
    [['PAPER', 'PARCHMENT', 'FAX'], FileText],
    [
        [
            'BROOM',
            'BRUSH',
            'MOP',
            'WIPER',
            'SCOURING',
            'STEEL WOOL',
            'RUG',
            'DOOR MAT',
        ],
        Brush,
    ],
    [
        [
            'SPRAY',
            'FRESHENER',
            'DEODORIZER',
            'DISINFECTANT',
            'REPELLANT',
            'CLEANER',
        ],
        SprayCan,
    ],
    [
        [
            'SOAP',
            'BLEACH',
            'ALCOHOL',
            'DETERGENT',
            'CONDITIONER',
            'CHLORINE',
            'SOSA',
            'ACID',
        ],
        Droplets,
    ],
    [['PAIL', 'DIPPER'], PaintBucket],
    [['TRASH', 'DUSTPAN'], Trash2],
    [['GLOVES'], Hand],
];

const categoryIcons: Record<SupplyCategoryKey, LucideIcon> = {
    office: Paperclip,
    cleaning: Sparkles,
    maintenance: Wrench,
    other: Package,
};

export const categoryLabels: Record<SupplyCategoryKey, string> = {
    office: 'Office',
    cleaning: 'Cleaning',
    maintenance: 'Maintenance',
    other: 'Other',
};

const categoryTints: Record<SupplyCategoryKey, string> = {
    office: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    cleaning:
        'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    maintenance:
        'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    other: 'bg-muted text-muted-foreground',
};

/** "Office Supplies & Stationery" → office, and so on. */
export function categoryKey(
    name: string | null | undefined,
): SupplyCategoryKey {
    const value = (name ?? '').toUpperCase();

    if (value.includes('OFFICE') || value.includes('STATIONERY')) {
        return 'office';
    }

    if (value.includes('CLEANING') || value.includes('HYGIENE')) {
        return 'cleaning';
    }

    if (value.includes('MAINTENANCE') || value.includes('TECHNICAL')) {
        return 'maintenance';
    }

    return 'other';
}

export function supplyVisual(
    name: string,
    category: string | null,
): SupplyVisual {
    const key = categoryKey(category);
    const upper = name.toUpperCase();
    const match = keywordIcons.find(([words]) =>
        words.some((word) => upper.includes(word)),
    );

    return { icon: match?.[1] ?? categoryIcons[key], category: key };
}

export function SupplyIcon({
    visual,
    className,
}: {
    visual: SupplyVisual;
    className?: string;
}) {
    const Icon = visual.icon;

    return (
        <span
            aria-hidden
            className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-lg',
                categoryTints[visual.category],
                className,
            )}
        >
            <Icon className="size-5" />
        </span>
    );
}

/**
 * Stock level for requesting: green while above the reorder point, amber
 * at or below it, red when nothing is left. `remaining` is what can still
 * be added (minus what's already in the request).
 */
export function StockTag({
    available,
    remaining,
    reorderPoint,
}: {
    available: number;
    remaining: number;
    reorderPoint: number;
}) {
    const [tone, text] =
        available <= 0
            ? [badgeTone.red, 'Out of stock']
            : available <= reorderPoint
              ? [badgeTone.amber, `Low · ${remaining} left`]
              : [badgeTone.green, `${remaining} available`];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums',
                tone,
            )}
        >
            <span className="size-1.5 rounded-full bg-current" />
            {text}
        </span>
    );
}
