/** The four RIS steps that take a signature, in form order. */
export type SignStep = 'requested' | 'approved' | 'issued' | 'received';

/**
 * Where a signature sits inside its box, as fractions of the box: x and y
 * are its centre, width its share of the box width, rotation in degrees.
 */
export type Placement = {
    x: number;
    y: number;
    width: number;
    rotation: number;
};

/** What a signing form sends: which saved signature, and where. */
export type PlacedSignature = Placement & { id: number };

/** One of the signed-in person's saved signatures. */
export type UserSignature = {
    id: number;
    name: string;
    source: 'drawn' | 'typed' | 'uploaded';
    is_default: boolean;
    url: string;
    created_at: string;
};

/** The e-signature frozen on an RIS at one step. */
export type RisSlipSignature = Placement & {
    id: number;
    step: SignStep;
    user_id: number | null;
    url: string;
    signed_at: string;
};

/** A signature to draw in a box; no placement means "centred" (older slips). */
export type BoxSignature = {
    url: string;
    placement: Placement | null;
};

export type RisDocumentSignatory = {
    name: string;
    designation: string | null;
    date: string | null;
    type: 'esign' | 'sgd' | null;
    signature: BoxSignature | null;
};

/** The RIS form (Appendix 63) as the signing preview draws it. */
export type RisDocument = {
    ris_no: string | null;
    entity_name: string | null;
    fund_cluster: string | null;
    division: string | null;
    office: string | null;
    responsibility_center_code: string | null;
    purpose: string | null;
    items: {
        stock_no: string | null;
        unit: string | null;
        description: string;
        requested: number;
        available: boolean | null;
        issued: number | null;
        remarks: string | null;
    }[];
    signatories: Record<SignStep, RisDocumentSignatory | null>;
};

/** A saved slip is loaded from the server; a new request is drawn from its draft. */
export type RisDocumentSource =
    | { slip: { route_key: string } }
    | { draft: RisDocument };
