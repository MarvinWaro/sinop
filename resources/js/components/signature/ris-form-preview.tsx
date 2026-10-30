import type { CSSProperties, ReactNode } from 'react';
import { SignatureBox } from '@/components/signature/signature-box';
import { formatDate, formatNumber } from '@/lib/format';
import {
    FORM_COLUMNS,
    SIGN_STEP_LABELS,
    SIGN_STEPS,
    SIGNATURE_BOXES,
} from '@/lib/signature-placement';
import { cn } from '@/lib/utils';
import type { RisDocument, SignStep } from '@/types';

const columns: CSSProperties = {
    gridTemplateColumns: FORM_COLUMNS.map((width) => `${width}fr`).join(' '),
};

const span = (start: number, count: number): CSSProperties => ({
    gridColumn: `${start + 1} / span ${count}`,
});

/** A bordered cell: the grid's 1px gaps over a dark background are the lines. */
function Cell({
    at,
    count = 1,
    className,
    children,
}: {
    at: number;
    count?: number;
    className?: string;
    children?: ReactNode;
}) {
    return (
        <div
            className={cn(
                'min-w-0 bg-white px-[0.6cqw] py-[0.3cqw]',
                className,
            )}
            style={span(at, count)}
        >
            {children}
        </div>
    );
}

const shaded = 'bg-[#f2f2f2] font-bold text-center';

/**
 * The RIS form (Appendix 63) on a white page, laid out like the Excel
 * export: same columns, same signature boxes. The signer's own box is
 * highlighted and holds `active` (the placement editor); the others are
 * shown as signed.
 */
export function RisFormPreview({
    document,
    activeStep,
    active,
    className,
}: {
    document: RisDocument;
    activeStep?: SignStep;
    active?: ReactNode;
    className?: string;
}) {
    const signatories = document.signatories;

    return (
        // The page is a size container: its text and spacing scale with its
        // width (cqw), so the form keeps its layout at any size.
        <div
            className={cn(
                '@container w-full bg-white text-neutral-900 shadow-sm',
                className,
            )}
        >
            <div className="p-[3cqw] text-[1.45cqw] leading-tight">
                <p className="text-right text-[1.9cqw] italic">Appendix 63</p>
                <h2 className="mt-[2cqw] mb-[2.5cqw] text-center text-[2.2cqw] font-bold">
                    REQUISITION AND ISSUE SLIP
                </h2>

                <div className="grid items-end gap-x-[0.6cqw]" style={columns}>
                    <span className="font-bold" style={span(0, 1)}>
                        Entity Name:
                    </span>
                    <span
                        className="truncate border-b border-neutral-900"
                        style={span(1, 5)}
                    >
                        {document.entity_name}
                    </span>
                    {/* Runs left over the empty end of the line, as in Excel. */}
                    <span
                        className="text-right font-bold whitespace-nowrap"
                        style={span(6, 1)}
                    >
                        Fund Cluster:
                    </span>
                    <span
                        className="truncate border-b border-neutral-900 text-right"
                        style={span(7, 1)}
                    >
                        {document.fund_cluster}
                    </span>
                </div>

                <div
                    className="mt-[0.8cqw] grid gap-px border border-neutral-900 bg-neutral-900"
                    style={columns}
                >
                    <Cell at={0} className="font-bold">
                        Division:
                    </Cell>
                    <Cell at={1} count={3} className="truncate">
                        {document.division}
                    </Cell>
                    <Cell at={4} className="text-[1.1cqw] font-bold">
                        Responsibility Center Code:
                    </Cell>
                    <Cell at={5} count={3}>
                        {document.responsibility_center_code}
                    </Cell>

                    <Cell at={0} className="font-bold">
                        Office:
                    </Cell>
                    <Cell at={1} count={3} className="truncate">
                        {document.office}
                    </Cell>
                    <Cell at={4} className="font-bold">
                        RIS No.:
                    </Cell>
                    <Cell at={5} count={3}>
                        {document.ris_no ?? (
                            <span className="text-neutral-500 italic">
                                Given when submitted
                            </span>
                        )}
                    </Cell>

                    <Cell at={0} count={4} className={shaded}>
                        Requisition
                    </Cell>
                    <Cell at={4} count={2} className={shaded}>
                        Stock Available?
                    </Cell>
                    <Cell at={6} count={2} className={shaded}>
                        Issue
                    </Cell>
                    {[
                        'Stock No.',
                        'Unit',
                        'Description',
                        'Quantity',
                        'Yes',
                        'No',
                        'Quantity',
                        'Remarks',
                    ].map((label, index) => (
                        <Cell
                            key={index}
                            at={index}
                            className={cn(shaded, 'text-[1.35cqw]')}
                        >
                            {label}
                        </Cell>
                    ))}

                    {document.items.map((item, index) => (
                        <ItemRow key={index} item={item} />
                    ))}

                    <Cell at={0} className="bg-[#f2f2f2] font-bold">
                        Purpose:
                    </Cell>
                    <Cell at={1} count={7} className="bg-[#f2f2f2]" />
                    <Cell
                        at={0}
                        count={8}
                        className="min-h-[4cqw] whitespace-pre-line"
                    >
                        {document.purpose}
                    </Cell>

                    <Cell at={0} count={2} />
                    {SIGN_STEPS.map((step) => (
                        <Cell
                            key={step}
                            at={SIGNATURE_BOXES[step].start}
                            count={SIGNATURE_BOXES[step].span}
                            className="text-center font-bold"
                        >
                            {SIGN_STEP_LABELS[step]}:
                        </Cell>
                    ))}

                    <Cell at={0} count={2} className="flex items-end font-bold">
                        Signature :
                    </Cell>
                    {SIGN_STEPS.map((step) => {
                        const signatory = signatories[step];
                        const isActive = step === activeStep;

                        return (
                            <Cell
                                key={step}
                                at={SIGNATURE_BOXES[step].start}
                                count={SIGNATURE_BOXES[step].span}
                                className={cn(
                                    'p-0',
                                    isActive &&
                                        'relative z-10 bg-sky-50 outline-2 outline-sky-500',
                                )}
                            >
                                <SignatureBox
                                    step={step}
                                    paper
                                    signature={
                                        isActive
                                            ? null
                                            : (signatory?.signature ?? null)
                                    }
                                >
                                    {isActive
                                        ? active
                                        : signatory?.type === 'sgd' && (
                                              <span className="absolute inset-0 flex items-center justify-center font-bold italic">
                                                  SGD
                                              </span>
                                          )}
                                </SignatureBox>
                            </Cell>
                        );
                    })}

                    <SignatoryRow label="Printed Name :" bold>
                        {(step) => signatories[step]?.name}
                    </SignatoryRow>
                    <SignatoryRow label="Designation :">
                        {(step) => signatories[step]?.designation}
                    </SignatoryRow>
                    <SignatoryRow label="Date :">
                        {(step) => {
                            const date = signatories[step]?.date;

                            return date ? formatDate(date) : null;
                        }}
                    </SignatoryRow>
                </div>
            </div>
        </div>
    );
}

function ItemRow({ item }: { item: RisDocument['items'][number] }) {
    return (
        <>
            <Cell at={0} className="text-center">
                {item.stock_no ?? 'N/A'}
            </Cell>
            <Cell at={1} className="truncate text-center">
                {item.unit ?? 'N/A'}
            </Cell>
            <Cell at={2} className="truncate">
                {item.description || 'N/A'}
            </Cell>
            <Cell at={3} className="text-center">
                {formatNumber(item.requested)}
            </Cell>
            <Cell at={4} className="text-center">
                {item.available === true ? '✓' : ''}
            </Cell>
            <Cell at={5} className="text-center">
                {item.available === false ? '✓' : ''}
            </Cell>
            <Cell at={6} className="text-center">
                {item.issued !== null ? formatNumber(item.issued) : ''}
            </Cell>
            <Cell at={7} className="truncate">
                {item.remarks}
            </Cell>
        </>
    );
}

function SignatoryRow({
    label,
    bold = false,
    children,
}: {
    label: string;
    bold?: boolean;
    children: (step: SignStep) => ReactNode;
}) {
    return (
        <>
            <Cell at={0} count={2} className="font-bold">
                {label}
            </Cell>
            {SIGN_STEPS.map((step) => (
                <Cell
                    key={step}
                    at={SIGNATURE_BOXES[step].start}
                    count={SIGNATURE_BOXES[step].span}
                    className={cn('truncate text-center', bold && 'font-bold')}
                >
                    {children(step)}
                </Cell>
            ))}
        </>
    );
}
