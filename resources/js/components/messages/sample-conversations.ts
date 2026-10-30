import type { RisStatus } from '@/types';

/**
 * Sample conversations for the Messages preview. Nothing here is saved or
 * read from the server: the real feature (request threads and concerns,
 * answered by the supply office) is a separate module.
 *
 * Messages are written by the requester, the office or the system (the
 * request's own history), so the same data reads from either side.
 */

export type Side = 'requester' | 'office' | 'system';

export type Attachment = {
    name: string;
    size: string;
    kind: 'sheet' | 'pdf' | 'image';
};

export type SampleMessage = {
    id: string;
    side: Side;
    /** Who wrote it (office replies name the officer). */
    author?: string;
    role?: string;
    at: string;
    body?: string;
    attachment?: Attachment;
};

export type ConversationStatus = 'open' | 'waiting' | 'resolved';

export type SampleConversation = {
    id: string;
    kind: 'request' | 'concern';
    title: string;
    requester: { name: string; division: string; photo?: string | null };
    status: ConversationStatus;
    /** Messages from the other side since the viewer last wrote. */
    unread: number;
    /** The office is replying right now (shown as typing dots). */
    typing?: boolean;
    ris?: {
        no: string;
        status: RisStatus;
        received_at: string | null;
        requested_at: string;
        items: { name: string; quantity: number; unit: string }[];
    };
    concern?: {
        category: string;
        property: string;
        property_no: string;
        location: string;
    };
    messages: SampleMessage[];
};

/** A time `days` ago at hh:mm, so the sample always looks recent. */
function at(days: number, time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hours, minutes, 0, 0);

    return date.toISOString();
}

export const OFFICE_PEOPLE = [
    { name: 'Juan Dela Cruz', role: 'Supply Officer' },
    { name: 'Maria Teresa L. Samonte', role: 'CAO' },
    { name: 'CHED Administrator', role: 'Administrator' },
];

const officer = { author: 'Juan Dela Cruz', role: 'Supply Officer' };
const cao = { author: 'Maria Teresa L. Samonte', role: 'CAO' };

const samples: Omit<SampleConversation, 'unread'>[] = [
    {
        id: 'c1',
        kind: 'request',
        title: 'RIS 2026-10-002',
        requester: {
            name: 'Alea Marie P. Deloso',
            division: 'Administrative Division',
        },
        status: 'open',
        typing: true,
        ris: {
            no: 'RIS 2026-10-002',
            status: 'approved',
            received_at: null,
            requested_at: at(1, '15:12'),
            items: [
                { name: 'Bond paper, A4', quantity: 3, unit: 'REAM' },
                { name: 'Alcohol, 70% isopropyl', quantity: 1, unit: 'GALLON' },
                { name: 'Sticky notes, 3x3', quantity: 2, unit: 'PAD' },
            ],
        },
        messages: [
            {
                id: 'm1',
                side: 'system',
                at: at(1, '15:12'),
                body: 'Request submitted with 3 items',
            },
            {
                id: 'm2',
                side: 'requester',
                at: at(1, '15:14'),
                body: 'Hi! Can I make the bond paper 3 reams instead of 2? We have the semestral reports next week.',
            },
            {
                id: 'm3',
                side: 'office',
                ...officer,
                at: at(1, '16:02'),
                body: 'Hi Alea, yes, there is enough stock. I updated it to 3 reams before approval.',
            },
            {
                id: 'm4',
                side: 'system',
                at: at(0, '08:47'),
                body: 'Approved by Maria Teresa L. Samonte',
            },
            {
                id: 'm5',
                side: 'office',
                ...officer,
                at: at(0, '09:38'),
                body: 'Your items are ready for pickup at the supply room, 2 to 4 PM today. Here is the RIS for your reference.',
            },
            {
                id: 'm6',
                side: 'office',
                ...officer,
                at: at(0, '09:38'),
                attachment: {
                    name: 'RIS_2026-10-002.xlsx',
                    size: '16 KB',
                    kind: 'sheet',
                },
            },
            {
                id: 'm7',
                side: 'requester',
                at: at(0, '09:41'),
                body: 'Perfect, I will drop by at 2. Thank you!',
            },
        ],
    },
    {
        id: 'c2',
        kind: 'concern',
        title: 'Printer not printing',
        requester: {
            name: 'Rafael C. Mangundaya',
            division: 'Technical Division',
        },
        status: 'waiting',
        concern: {
            category: 'Property repair',
            property: 'Epson L3210 printer',
            property_no: 'PPE-2024-0117',
            location: 'Technical Division, 2nd floor',
        },
        messages: [
            {
                id: 'm1',
                side: 'requester',
                at: at(0, '08:15'),
                body: 'Good morning. The printer in our office shows a paper jam light, but there is no paper stuck inside. Photo attached.',
            },
            {
                id: 'm2',
                side: 'requester',
                at: at(0, '08:16'),
                attachment: {
                    name: 'printer-error.jpg',
                    size: '1.2 MB',
                    kind: 'image',
                },
            },
        ],
    },
    {
        id: 'c3',
        kind: 'request',
        title: 'RIS 2026-10-001',
        requester: {
            name: 'Alea Marie P. Deloso',
            division: 'Administrative Division',
        },
        status: 'resolved',
        ris: {
            no: 'RIS 2026-10-001',
            status: 'posted',
            received_at: at(3, '14:20'),
            requested_at: at(4, '10:05'),
            items: [
                {
                    name: 'All purpose cleaner, 500ml',
                    quantity: 1,
                    unit: 'BOTTLE',
                },
            ],
        },
        messages: [
            {
                id: 'm1',
                side: 'requester',
                at: at(4, '10:07'),
                body: 'Is the all purpose cleaner available in the bigger bottle?',
            },
            {
                id: 'm2',
                side: 'office',
                ...officer,
                at: at(4, '10:30'),
                body: 'Only the 500ml for now. The gallon size arrives with the next delivery.',
            },
            {
                id: 'm3',
                side: 'system',
                at: at(3, '14:20'),
                body: 'Received by Alea Marie P. Deloso',
            },
        ],
    },
    {
        id: 'c4',
        kind: 'request',
        title: 'RIS 2026-09-118',
        requester: {
            name: 'Kristine Joy B. Lim',
            division: 'Office of the Regional Director',
        },
        status: 'open',
        ris: {
            no: 'RIS 2026-09-118',
            status: 'posted',
            received_at: null,
            requested_at: at(6, '09:00'),
            items: [{ name: 'Toner, HP 107A', quantity: 3, unit: 'PIECE' }],
        },
        messages: [
            {
                id: 'm1',
                side: 'system',
                at: at(5, '11:10'),
                body: 'Issued 1 of 3 (partial: not enough stock)',
            },
            {
                id: 'm2',
                side: 'office',
                ...cao,
                at: at(5, '11:15'),
                body: 'We could only issue 1 toner for now. The other 2 are in the IAR due next week; we will message you here when they arrive.',
            },
            {
                id: 'm3',
                side: 'requester',
                at: at(5, '11:40'),
                body: 'Noted, thank you, Ma’am.',
            },
        ],
    },
    {
        id: 'c5',
        kind: 'concern',
        title: 'When will folders be restocked?',
        requester: {
            name: 'Mark Anthony S. Reyes',
            division: 'Scholarship Division',
        },
        status: 'resolved',
        concern: {
            category: 'Stock question',
            property: 'Folder, expanding long',
            property_no: 'Stock no. 141',
            location: 'Supply room',
        },
        messages: [
            {
                id: 'm1',
                side: 'requester',
                at: at(8, '13:02'),
                body: 'Hi, the expanding folders show as out of stock. Any idea when they will be available?',
            },
            {
                id: 'm2',
                side: 'office',
                ...officer,
                at: at(8, '15:45'),
                body: 'They are in this month’s purchase request. Expect them by the 2nd week.',
            },
        ],
    },
    {
        id: 'c6',
        kind: 'request',
        title: 'RIS 2026-10-004',
        requester: {
            name: 'Jose Paolo D. Ramos',
            division: 'Technical Division',
        },
        status: 'waiting',
        ris: {
            no: 'RIS 2026-10-004',
            status: 'draft',
            received_at: null,
            requested_at: at(2, '10:30'),
            items: [
                { name: 'Ballpen, black', quantity: 12, unit: 'PIECE' },
                { name: 'Notebook, spiral', quantity: 5, unit: 'PIECE' },
            ],
        },
        messages: [
            {
                id: 'm1',
                side: 'system',
                at: at(2, '10:30'),
                body: 'Request submitted with 2 items',
            },
            {
                id: 'm2',
                side: 'requester',
                at: at(2, '10:33'),
                body: 'Hello, this is for the training next Monday. Can it be approved before Friday?',
            },
        ],
    },
];

/**
 * Unread: what the other side wrote after the viewer's last message (the
 * request's own events don't count). Resolved conversations have none.
 */
function unreadFor(
    conversation: Omit<SampleConversation, 'unread'>,
    mySide: Side,
): number {
    if (conversation.status === 'resolved') {
        return 0;
    }

    let count = 0;

    for (const message of [...conversation.messages].reverse()) {
        if (message.side === mySide) {
            break;
        }

        if (message.side !== 'system') {
            count++;
        }
    }

    return count;
}

/** The sample as one side sees it (office: the shared inbox; staff: theirs). */
export function sampleConversationsFor(mySide: Side): SampleConversation[] {
    return samples.map((conversation) => ({
        ...conversation,
        unread: unreadFor(conversation, mySide),
    }));
}
