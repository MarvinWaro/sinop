import { useEffect, useRef, useState } from 'react';
import type {
    PointerEvent as ReactPointerEvent,
    ReactNode,
    RefObject,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight SVG charts (no extra npm dependency) using the shadcn chart
 * color tokens (--chart-1 ... --chart-5).
 *
 * The axis charts measure their container and draw in real pixels, so text
 * stays 12px and the plot keeps its height on any screen width (a fixed
 * viewBox stretched to the card made everything grow on wide screens).
 */

export const chartColors = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'oklch(0.55 0.15 300)',
    'oklch(0.6 0.13 150)',
    'oklch(0.5 0.12 20)',
];

export type ChartSeries = {
    name: string;
    values: number[];
    color?: string;
};

type AxisChartProps = {
    labels: string[];
    series: ChartSeries[];
    height?: number;
    className?: string;
    formatValue?: (value: number) => string;
};

const FONT_SIZE = 12;
const DEFAULT_HEIGHT = 260;

function defaultFormat(value: number): string {
    return Math.round(value).toLocaleString('en-US');
}

function seriesColor(series: ChartSeries, index: number): string {
    return series.color ?? chartColors[index % chartColors.length];
}

/** Width of the element in CSS pixels, kept up to date as it resizes. */
function useElementWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = ref.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            setWidth(Math.floor(entry.contentRect.width));
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
}

/**
 * Round tick spacing (1, 2, 2.5 or 5 × 10ⁿ) giving at most `count` intervals,
 * so the axis reads 0 / 1k / 2k / 3k instead of 0 / 1.3k / 2.5k / 3.8k.
 */
function niceTicks(
    maxValue: number,
    integersOnly: boolean,
    count = 4,
): number[] {
    if (maxValue <= 0) {
        return integersOnly ? [0, 1, 2, 3, 4] : [0, 0.25, 0.5, 0.75, 1];
    }

    const raw = maxValue / count;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const normalized = raw / magnitude;
    const factor =
        normalized <= 1
            ? 1
            : normalized <= 2
              ? 2
              : normalized <= 2.5
                ? 2.5
                : normalized <= 5
                  ? 5
                  : 10;
    const step = Math.max(factor * magnitude, integersOnly ? 1 : 0);
    const intervals = Math.max(1, Math.ceil(maxValue / step - 1e-9));

    return Array.from({ length: intervals + 1 }, (_, index) => index * step);
}

/** Show every nth category label when there isn't room for all of them. */
function labelEvery(step: number, labels: string[]): number {
    const longest = Math.max(1, ...labels.map((label) => label.length));
    const needed = longest * FONT_SIZE * 0.6 + 12;

    return Math.max(1, Math.ceil(needed / Math.max(step, 1)));
}

/** Smooth path through the points that never overshoots (monotone cubic, like d3's curveMonotoneX). */
function monotonePath(points: { x: number; y: number }[]): string {
    if (points.length === 0) {
        return '';
    }

    if (points.length < 3) {
        return points
            .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
            .join(' ');
    }

    const n = points.length;
    const slopes: number[] = [];
    const tangents: number[] = Array.from({ length: n }, () => 0);

    for (let i = 0; i < n - 1; i++) {
        slopes.push(
            (points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x),
        );
    }

    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];

    for (let i = 1; i < n - 1; i++) {
        tangents[i] =
            slopes[i - 1] * slopes[i] <= 0
                ? 0
                : (slopes[i - 1] + slopes[i]) / 2;
    }

    for (let i = 0; i < n - 1; i++) {
        if (slopes[i] === 0) {
            tangents[i] = 0;
            tangents[i + 1] = 0;
            continue;
        }

        const a = tangents[i] / slopes[i];
        const b = tangents[i + 1] / slopes[i];
        const h = a * a + b * b;

        if (h > 9) {
            const t = 3 / Math.sqrt(h);
            tangents[i] = t * a * slopes[i];
            tangents[i + 1] = t * b * slopes[i];
        }
    }

    let path = `M${points[0].x},${points[0].y}`;

    for (let i = 0; i < n - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const dx = (p1.x - p0.x) / 3;

        path += ` C${p0.x + dx},${p0.y + tangents[i] * dx} ${p1.x - dx},${p1.y - tangents[i + 1] * dx} ${p1.x},${p1.y}`;
    }

    return path;
}

function Legend({ series }: { series: ChartSeries[] }) {
    if (series.length < 2) {
        return null;
    }

    return (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {series.map((s, index) => (
                <span key={s.name} className="inline-flex items-center gap-1.5">
                    <span
                        className="size-2.5 rounded-full"
                        style={{ background: seriesColor(s, index) }}
                    />
                    {s.name}
                </span>
            ))}
        </div>
    );
}

function Tooltip({
    x,
    width,
    children,
}: {
    x: number;
    width: number;
    children: ReactNode;
}) {
    // Keep the tooltip inside the chart near the left and right edges.
    const flip = x > width - 180;

    return (
        <div
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            style={flip ? { right: width - x + 12 } : { left: x + 12 }}
        >
            {children}
        </div>
    );
}

function TooltipRows({
    title,
    series,
    index,
    formatValue,
}: {
    title: string;
    series: ChartSeries[];
    index: number;
    formatValue: (value: number) => string;
}) {
    return (
        <>
            <p className="mb-1 font-medium">{title}</p>
            <div className="grid gap-1">
                {series.map((s, sIndex) => (
                    <div
                        key={s.name}
                        className="flex items-center justify-between gap-4"
                    >
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span
                                className="size-2 rounded-full"
                                style={{ background: seriesColor(s, sIndex) }}
                            />
                            {s.name}
                        </span>
                        <span className="font-medium tabular-nums">
                            {formatValue(s.values[index] ?? 0)}
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

type Layout = {
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    innerWidth: number;
    innerHeight: number;
    step: number;
    ticks: number[];
    max: number;
    y: (value: number) => number;
};

function useAxisLayout(
    width: number,
    height: number,
    labels: string[],
    series: ChartSeries[],
    formatValue: (value: number) => string,
): Layout {
    const values = series.flatMap((s) => s.values);
    const integersOnly = values.every((value) => Number.isInteger(value));
    const ticks = niceTicks(Math.max(0, ...values), integersOnly);
    const max = ticks[ticks.length - 1] || 1;
    const longestTick = Math.max(
        ...ticks.map((tick) => formatValue(tick).length),
    );

    const top = 12;
    const bottom = 28;
    const right = 8;
    const left = Math.ceil(longestTick * FONT_SIZE * 0.62) + 16;
    const innerWidth = Math.max(width - left - right, 0);
    const innerHeight = Math.max(height - top - bottom, 0);
    const step = labels.length > 0 ? innerWidth / labels.length : innerWidth;

    return {
        width,
        height,
        left,
        right,
        top,
        bottom,
        innerWidth,
        innerHeight,
        step,
        ticks,
        max,
        y: (value) => top + innerHeight - (value / max) * innerHeight,
    };
}

function Axes({
    layout,
    labels,
    formatValue,
}: {
    layout: Layout;
    labels: string[];
    formatValue: (value: number) => string;
}) {
    const every = labelEvery(layout.step, labels);

    return (
        <g className="text-muted-foreground" fontSize={FONT_SIZE}>
            {layout.ticks.map((tick) => {
                const y = layout.y(tick);

                return (
                    <g key={tick}>
                        <line
                            x1={layout.left}
                            x2={layout.width - layout.right}
                            y1={y}
                            y2={y}
                            stroke="currentColor"
                            strokeOpacity={tick === 0 ? 0.35 : 0.18}
                            strokeDasharray={tick === 0 ? undefined : '3 3'}
                        />
                        <text
                            x={layout.left - 10}
                            y={y}
                            dy="0.32em"
                            textAnchor="end"
                            fill="currentColor"
                        >
                            {formatValue(tick)}
                        </text>
                    </g>
                );
            })}
            {labels.map((label, index) =>
                index % every === 0 ? (
                    <text
                        key={`${label}-${index}`}
                        x={layout.left + layout.step * index + layout.step / 2}
                        y={layout.height - 8}
                        textAnchor="middle"
                        fill="currentColor"
                    >
                        {label}
                    </text>
                ) : null,
            )}
        </g>
    );
}

/** Index of the category under the pointer, or null outside the plot. */
function useHoverIndex(layout: Layout, count: number) {
    const [hover, setHover] = useState<number | null>(null);

    const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - box.left - layout.left;
        const index = Math.floor(x / layout.step);

        setHover(index >= 0 && index < count ? index : null);
    };

    return { hover, onPointerMove, onPointerLeave: () => setHover(null) };
}

function ChartFrame({
    height,
    className,
    series,
    containerRef,
    children,
}: {
    height: number;
    className?: string;
    series: ChartSeries[];
    containerRef: RefObject<HTMLDivElement | null>;
    children: ReactNode;
}) {
    return (
        <div className={cn('w-full', className)}>
            <div
                ref={containerRef}
                className="relative w-full"
                style={{ height }}
            >
                {children}
            </div>
            <Legend series={series} />
        </div>
    );
}

export function BarChart({
    labels,
    series,
    height = DEFAULT_HEIGHT,
    className,
    formatValue = defaultFormat,
}: AxisChartProps) {
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const layout = useAxisLayout(width, height, labels, series, formatValue);
    const { hover, onPointerMove, onPointerLeave } = useHoverIndex(
        layout,
        labels.length,
    );

    const groupWidth = Math.min(
        layout.step * 0.64,
        28 * Math.max(series.length, 1) + 8,
    );
    const gap = series.length > 1 ? 3 : 0;
    const barWidth =
        series.length > 0
            ? (groupWidth - gap * (series.length - 1)) / series.length
            : groupWidth;
    const radius = Math.min(4, barWidth / 2);

    return (
        <ChartFrame
            height={height}
            className={className}
            series={series}
            containerRef={ref}
        >
            {width > 0 && (
                <svg
                    width={width}
                    height={height}
                    role="img"
                    aria-label={series.map((s) => s.name).join(', ')}
                    onPointerMove={onPointerMove}
                    onPointerLeave={onPointerLeave}
                >
                    {hover !== null && (
                        <rect
                            x={layout.left + layout.step * hover + 2}
                            y={layout.top}
                            width={Math.max(layout.step - 4, 0)}
                            height={layout.innerHeight}
                            rx={4}
                            className="fill-muted"
                        />
                    )}
                    <Axes
                        layout={layout}
                        labels={labels}
                        formatValue={formatValue}
                    />
                    {series.map((s, sIndex) =>
                        s.values.map((value, index) => {
                            if (value <= 0) {
                                return null;
                            }

                            const x =
                                layout.left +
                                layout.step * index +
                                (layout.step - groupWidth) / 2 +
                                (barWidth + gap) * sIndex;
                            const y = layout.y(value);
                            const h = layout.top + layout.innerHeight - y;
                            const r = Math.min(radius, h);

                            // Rounded top corners, square base on the axis.
                            const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barWidth - r} Q${x + barWidth},${y} ${x + barWidth},${y + r} V${y + h} Z`;

                            return (
                                <path
                                    key={`${s.name}-${index}`}
                                    d={d}
                                    fill={seriesColor(s, sIndex)}
                                />
                            );
                        }),
                    )}
                </svg>
            )}
            {hover !== null && width > 0 && (
                <Tooltip
                    x={layout.left + layout.step * (hover + 0.5)}
                    width={width}
                >
                    <TooltipRows
                        title={labels[hover]}
                        series={series}
                        index={hover}
                        formatValue={formatValue}
                    />
                </Tooltip>
            )}
        </ChartFrame>
    );
}

export function LineChart({
    labels,
    series,
    height = DEFAULT_HEIGHT,
    className,
    formatValue = defaultFormat,
}: AxisChartProps) {
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const layout = useAxisLayout(width, height, labels, series, formatValue);
    const { hover, onPointerMove, onPointerLeave } = useHoverIndex(
        layout,
        labels.length,
    );
    const baseline = layout.top + layout.innerHeight;

    const pointsOf = (s: ChartSeries) =>
        s.values.map((value, index) => ({
            x: layout.left + layout.step * index + layout.step / 2,
            y: layout.y(value),
        }));

    return (
        <ChartFrame
            height={height}
            className={className}
            series={series}
            containerRef={ref}
        >
            {width > 0 && (
                <svg
                    width={width}
                    height={height}
                    role="img"
                    aria-label={series.map((s) => s.name).join(', ')}
                    onPointerMove={onPointerMove}
                    onPointerLeave={onPointerLeave}
                >
                    <Axes
                        layout={layout}
                        labels={labels}
                        formatValue={formatValue}
                    />
                    {hover !== null && (
                        <line
                            x1={layout.left + layout.step * (hover + 0.5)}
                            x2={layout.left + layout.step * (hover + 0.5)}
                            y1={layout.top}
                            y2={baseline}
                            className="stroke-border"
                        />
                    )}
                    {series.map((s, sIndex) => {
                        const color = seriesColor(s, sIndex);
                        const points = pointsOf(s);
                        const line = monotonePath(points);
                        const first = points[0];
                        const last = points[points.length - 1];
                        // A soft fill only when there's a single line; overlapping fills muddy several.
                        const area =
                            series.length === 1 && first && last
                                ? `${line} L${last.x},${baseline} L${first.x},${baseline} Z`
                                : null;

                        return (
                            <g key={s.name}>
                                {area && (
                                    <path
                                        d={area}
                                        fill={color}
                                        fillOpacity={0.1}
                                    />
                                )}
                                <path
                                    d={line}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={2}
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                                {points.map((p, index) => (
                                    <circle
                                        key={index}
                                        cx={p.x}
                                        cy={p.y}
                                        r={hover === index ? 4.5 : 3}
                                        fill={color}
                                        className="stroke-card"
                                        strokeWidth={1.5}
                                    />
                                ))}
                            </g>
                        );
                    })}
                </svg>
            )}
            {hover !== null && width > 0 && (
                <Tooltip
                    x={layout.left + layout.step * (hover + 0.5)}
                    width={width}
                >
                    <TooltipRows
                        title={labels[hover]}
                        series={series}
                        index={hover}
                        formatValue={formatValue}
                    />
                </Tooltip>
            )}
        </ChartFrame>
    );
}

export type DonutSlice = {
    label: string;
    value: number;
    color?: string;
};

export function DonutChart({
    data,
    size = 200,
    className,
    centerLabel,
    formatValue = defaultFormat,
    orientation = 'vertical',
}: {
    data: DonutSlice[];
    size?: number;
    className?: string;
    centerLabel?: string;
    formatValue?: (value: number) => string;
    /** `horizontal` puts the legend beside the ring (from the sm breakpoint) to save height. */
    orientation?: 'vertical' | 'horizontal';
}) {
    const [active, setActive] = useState<number | null>(null);
    const total = data.reduce((sum, slice) => sum + slice.value, 0);
    const radius = 80;
    const stroke = 28;
    const circumference = 2 * Math.PI * radius;

    // Precompute each slice's arc length and starting offset.
    const arcs = data.map((slice, index) => {
        const length = total > 0 ? (slice.value / total) * circumference : 0;
        const start = data
            .slice(0, index)
            .reduce(
                (sum, previous) =>
                    sum +
                    (total > 0 ? (previous.value / total) * circumference : 0),
                0,
            );

        return { slice, length, start };
    });

    const activeSlice = active !== null ? data[active] : null;

    // Fit the centre text inside the hole (viewBox units): long peso totals
    // shrink instead of spilling over the ring.
    const hole = 2 * (radius - (stroke + 6) / 2) - 16;
    const centerValue = formatValue(activeSlice ? activeSlice.value : total);
    const valueSize = Math.max(
        12,
        Math.min(22, Math.floor(hole / (centerValue.length * 0.6))),
    );
    const labelText = activeSlice
        ? activeSlice.label
        : (centerLabel ?? 'Total');
    const maxLabelChars = Math.floor(hole / (11 * 0.55));
    const centerText =
        labelText.length > maxLabelChars
            ? `${labelText.slice(0, maxLabelChars - 1)}…`
            : labelText;

    return (
        <div
            className={cn(
                'flex flex-col items-center gap-4',
                orientation === 'horizontal' && 'sm:flex-row sm:gap-6',
                className,
            )}
        >
            <svg
                viewBox="0 0 200 200"
                width={size}
                height={size}
                role="img"
                className="shrink-0"
            >
                <circle
                    cx={100}
                    cy={100}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={0.08}
                    strokeWidth={stroke}
                />
                {total > 0 &&
                    arcs.map(({ slice, length, start }, index) => (
                        <circle
                            key={slice.label}
                            cx={100}
                            cy={100}
                            r={radius}
                            fill="none"
                            stroke={
                                slice.color ??
                                chartColors[index % chartColors.length]
                            }
                            strokeWidth={active === index ? stroke + 6 : stroke}
                            strokeDasharray={`${length} ${circumference - length}`}
                            strokeDashoffset={-start}
                            transform="rotate(-90 100 100)"
                            onMouseEnter={() => setActive(index)}
                            onMouseLeave={() => setActive(null)}
                            className="cursor-pointer transition-[stroke-width]"
                        >
                            <title>{`${slice.label}: ${formatValue(slice.value)}`}</title>
                        </circle>
                    ))}
                <text
                    x={100}
                    y={97}
                    textAnchor="middle"
                    fontSize={valueSize}
                    fontWeight={600}
                    fill="currentColor"
                    className="tabular-nums"
                >
                    {centerValue}
                </text>
                <text
                    x={100}
                    y={116}
                    textAnchor="middle"
                    fontSize={11}
                    fill="currentColor"
                    opacity={0.6}
                >
                    {centerText}
                </text>
            </svg>
            <DonutLegend
                data={data}
                formatValue={formatValue}
                onActive={setActive}
            />
        </div>
    );
}

/**
 * A donut's legend: colour, label, value and share. Also used beside other
 * pictures of the same numbers (the stock overview's box), so they read the
 * same. `onActive` gets the row the pointer is on (null when it leaves).
 */
export function DonutLegend({
    data,
    formatValue = defaultFormat,
    onActive,
}: {
    data: DonutSlice[];
    formatValue?: (value: number) => string;
    onActive?: (index: number | null) => void;
}) {
    const total = data.reduce((sum, slice) => sum + slice.value, 0);

    return (
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm">
            {data.map((slice, index) => (
                <div
                    key={slice.label}
                    className="flex items-center justify-between gap-3"
                    onMouseEnter={() => onActive?.(index)}
                    onMouseLeave={() => onActive?.(null)}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{
                                background:
                                    slice.color ??
                                    chartColors[index % chartColors.length],
                            }}
                        />
                        <span
                            className="truncate text-muted-foreground"
                            title={slice.label}
                        >
                            {slice.label}
                        </span>
                    </span>
                    <span className="font-medium tabular-nums">
                        {formatValue(slice.value)}
                        {total > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                                ({((slice.value / total) * 100).toFixed(1)}%)
                            </span>
                        )}
                    </span>
                </div>
            ))}
        </div>
    );
}

export type ShareSegment = { label: string; value: number; color: string };

/** "42%", or "<1%" for a share too small to round up. */
function shareText(value: number, total: number): string {
    const share = total > 0 ? (value / total) * 100 : 0;

    return share > 0 && share < 1 ? '<1%' : `${Math.round(share)}%`;
}

/**
 * Part-to-whole as one segmented bar with its legend below (label, count,
 * share). For small cards, where a donut would be mostly empty ring.
 * Pointing at a segment or a legend row brings that one forward.
 */
export function ShareBar({
    data,
    formatValue = defaultFormat,
    className,
}: {
    data: ShareSegment[];
    formatValue?: (value: number) => string;
    className?: string;
}) {
    const [active, setActive] = useState<string | null>(null);
    const total = data.reduce((sum, segment) => sum + segment.value, 0);
    const dimmed = (label: string) => active !== null && active !== label;

    return (
        <div className={cn('grid gap-4', className)}>
            <div
                role="img"
                aria-label={data
                    .map(
                        (segment) =>
                            `${segment.label}: ${formatValue(segment.value)}`,
                    )
                    .join(', ')}
                className="flex h-2.5 gap-0.5"
            >
                {data
                    .filter((segment) => segment.value > 0)
                    .map((segment) => (
                        <div
                            key={segment.label}
                            title={`${segment.label}: ${formatValue(segment.value)} (${shareText(segment.value, total)})`}
                            onMouseEnter={() => setActive(segment.label)}
                            onMouseLeave={() => setActive(null)}
                            className={cn(
                                'min-w-1 basis-0 rounded-[2px] transition-opacity first:rounded-l-full last:rounded-r-full',
                                dimmed(segment.label) && 'opacity-30',
                            )}
                            style={{
                                flexGrow: segment.value,
                                background: segment.color,
                            }}
                        />
                    ))}
            </div>
            <ul className="grid gap-2 text-sm">
                {data.map((segment) => (
                    <li
                        key={segment.label}
                        onMouseEnter={() => setActive(segment.label)}
                        onMouseLeave={() => setActive(null)}
                        className={cn(
                            'flex items-center gap-2 transition-opacity',
                            dimmed(segment.label) && 'opacity-50',
                        )}
                    >
                        <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: segment.color }}
                        />
                        <span
                            className="min-w-0 flex-1 truncate text-muted-foreground"
                            title={segment.label}
                        >
                            {segment.label}
                        </span>
                        <span className="font-medium tabular-nums">
                            {formatValue(segment.value)}
                        </span>
                        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                            {shareText(segment.value, total)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Ranked horizontal bars (top items, departments, ...). */
export function BarList({
    data,
    formatValue = defaultFormat,
    color,
    className,
}: {
    data: { label: string; value: number; hint?: string }[];
    formatValue?: (value: number) => string;
    /** One colour for every bar (a single measure); default: a colour per row. */
    color?: string;
    className?: string;
}) {
    const max = Math.max(0, ...data.map((d) => d.value));

    return (
        <div className={cn('grid gap-3', className)}>
            {data.map((item, index) => (
                <div key={`${item.label}-${index}`} className="grid gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                            {item.label}
                            {item.hint && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                    {item.hint}
                                </span>
                            )}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                            {formatValue(item.value)}
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${max > 0 ? (item.value / max) * 100 : 0}%`,
                                background:
                                    color ??
                                    chartColors[index % chartColors.length],
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

export type ScatterPoint = {
    x: number;
    y: number;
    /** Relative bubble size (any positive number); scaled to 3–9px. */
    size?: number;
    label: string;
    detail?: string;
};

/** Simple scatter / bubble plot with linear x and y axes starting at zero. */
export function ScatterChart({
    points,
    height = DEFAULT_HEIGHT,
    className,
    xLabel,
    yLabel,
    formatX = defaultFormat,
    formatY = defaultFormat,
}: {
    points: ScatterPoint[];
    height?: number;
    className?: string;
    xLabel?: string;
    yLabel?: string;
    formatX?: (value: number) => string;
    formatY?: (value: number) => string;
}) {
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const [hover, setHover] = useState<number | null>(null);

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xTicks = niceTicks(Math.max(0, ...xs), xs.every(Number.isInteger));
    const yTicks = niceTicks(Math.max(0, ...ys), ys.every(Number.isInteger));
    const maxX = xTicks[xTicks.length - 1] || 1;
    const maxY = yTicks[yTicks.length - 1] || 1;
    const longestY = Math.max(...yTicks.map((tick) => formatY(tick).length));

    const pad = {
        top: 12,
        right: 16,
        bottom: xLabel ? 44 : 28,
        left: Math.ceil(longestY * FONT_SIZE * 0.62) + (yLabel ? 32 : 16),
    };
    const innerWidth = Math.max(width - pad.left - pad.right, 0);
    const innerHeight = Math.max(height - pad.top - pad.bottom, 0);
    const maxSize = Math.max(0, ...points.map((p) => p.size ?? 0));
    const toX = (value: number) => pad.left + (value / maxX) * innerWidth;
    const toY = (value: number) =>
        pad.top + innerHeight - (value / maxY) * innerHeight;
    const hovered = hover !== null ? points[hover] : null;

    return (
        <div className={cn('w-full', className)}>
            <div ref={ref} className="relative w-full" style={{ height }}>
                {width > 0 && (
                    <svg
                        width={width}
                        height={height}
                        role="img"
                        aria-label={
                            yLabel && xLabel
                                ? `${yLabel} by ${xLabel}`
                                : undefined
                        }
                    >
                        <g
                            className="text-muted-foreground"
                            fontSize={FONT_SIZE}
                        >
                            {yTicks.map((tick) => (
                                <g key={`y-${tick}`}>
                                    <line
                                        x1={pad.left}
                                        x2={width - pad.right}
                                        y1={toY(tick)}
                                        y2={toY(tick)}
                                        stroke="currentColor"
                                        strokeOpacity={tick === 0 ? 0.35 : 0.18}
                                        strokeDasharray={
                                            tick === 0 ? undefined : '3 3'
                                        }
                                    />
                                    <text
                                        x={pad.left - 10}
                                        y={toY(tick)}
                                        dy="0.32em"
                                        textAnchor="end"
                                        fill="currentColor"
                                    >
                                        {formatY(tick)}
                                    </text>
                                </g>
                            ))}
                            {xTicks.map((tick) => (
                                <text
                                    key={`x-${tick}`}
                                    x={toX(tick)}
                                    y={pad.top + innerHeight + 18}
                                    textAnchor="middle"
                                    fill="currentColor"
                                >
                                    {formatX(tick)}
                                </text>
                            ))}
                            {xLabel && (
                                <text
                                    x={pad.left + innerWidth / 2}
                                    y={height - 6}
                                    textAnchor="middle"
                                    fill="currentColor"
                                >
                                    {xLabel}
                                </text>
                            )}
                            {yLabel && (
                                <text
                                    x={12}
                                    y={pad.top + innerHeight / 2}
                                    textAnchor="middle"
                                    fill="currentColor"
                                    transform={`rotate(-90 12 ${pad.top + innerHeight / 2})`}
                                >
                                    {yLabel}
                                </text>
                            )}
                        </g>
                        {points.map((p, index) => {
                            const r =
                                maxSize > 0 && p.size
                                    ? 3 + (p.size / maxSize) * 6
                                    : 4;

                            return (
                                <circle
                                    key={`${p.label}-${index}`}
                                    cx={toX(p.x)}
                                    cy={toY(p.y)}
                                    r={hover === index ? r + 2 : r}
                                    fill={chartColors[0]}
                                    fillOpacity={hover === index ? 0.9 : 0.55}
                                    stroke={chartColors[0]}
                                    onPointerEnter={() => setHover(index)}
                                    onPointerLeave={() => setHover(null)}
                                    className="cursor-pointer"
                                />
                            );
                        })}
                    </svg>
                )}
                {hovered && width > 0 && (
                    <Tooltip x={toX(hovered.x)} width={width}>
                        <p className="mb-1 font-medium">{hovered.label}</p>
                        {hovered.detail && (
                            <p className="whitespace-pre-line text-muted-foreground">
                                {hovered.detail}
                            </p>
                        )}
                    </Tooltip>
                )}
            </div>
        </div>
    );
}
