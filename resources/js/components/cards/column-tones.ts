/**
 * Light column-group tints for the Stock Card and Supply Ledger Card tables,
 * as on the old CIMS screens: receipts green, issues red, balance blue.
 * The header is a step stronger than the body so the groups read at a glance.
 */
export const columnTones = {
    receipt: {
        head: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200',
        subhead: 'bg-emerald-50/60 dark:bg-emerald-500/10',
        cell: 'bg-emerald-50/40 dark:bg-emerald-500/5',
        value: 'font-medium text-emerald-700 dark:text-emerald-400',
    },
    issue: {
        head: 'bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-200',
        subhead: 'bg-red-50/60 dark:bg-red-500/10',
        cell: 'bg-red-50/40 dark:bg-red-500/5',
        value: 'font-medium text-red-700 dark:text-red-400',
    },
    balance: {
        head: 'bg-blue-50 text-blue-900 dark:bg-blue-500/15 dark:text-blue-200',
        subhead: 'bg-blue-50/60 dark:bg-blue-500/10',
        cell: 'bg-blue-50/40 dark:bg-blue-500/5',
        value: 'font-medium',
    },
} as const;

/** Shared header rows for the card tables: column titles centred and in capitals, as on the forms. */
export const cardTableHead = 'bg-muted/60 text-xs uppercase [&_th]:text-center';

/** Card table rows: every value centred, as on the old CIMS screens and the printed forms. */
export const cardTableBody = '[&_td]:text-center';
