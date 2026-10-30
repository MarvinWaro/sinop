/**
 * Shapes of the Eloquent models as they arrive from Laravel (JSON).
 * Decimal columns cast with `decimal:2` come through as strings.
 */

import type { RisSlipSignature } from './signatures';

export type Role = 'admin' | 'cao' | 'staff';

export type Department = {
    id: number;
    name: string;
    created_at?: string | null;
    updated_at?: string | null;
};

export type Designation = {
    id: number;
    name: string;
    description?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type Category = {
    id: number;
    name: string;
    description: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export type Supplier = {
    id: number;
    name: string;
    email: string | null;
    contact_number: string;
    address: string | null;
    contact_person: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export type Location = {
    id: number;
    location_name: string;
    active: boolean | number;
    excluded: boolean | number;
    created_at: string | null;
    updated_at: string | null;
};

export type AppUser = {
    id: number;
    name: string;
    email: string;
    role: Role;
    department_id: number | null;
    designation_id: number | null;
    status: boolean | number;
    needs_password_change?: boolean;
    profile_photo_url: string;
    avatar?: string | null;
    signature_path?: string | null;
    signature_url?: string | null;
    department?: Department | null;
    designation?: Designation | null;
    /** The user's roles (Settings › Users loads them). */
    roles?: Pick<AppRole, 'id' | 'name' | 'slug'>[];
    created_at?: string | null;
    updated_at?: string | null;
};

/** A role from Settings › Roles & permissions. `admin` is the super admin. */
export type AppRole = {
    id: number;
    name: string;
    slug: string;
    description: string | null;
};

export type Supply = {
    supply_id: number;
    stock_no: string;
    item_name: string;
    description: string | null;
    unit_of_measurement: string;
    category_id: number | null;
    reorder_point: number;
    acquisition_cost: string;
    is_active: boolean;
    category?: Category | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type StockStatus = 'available' | 'reserved' | 'expired' | 'depleted';

export type SupplyStock = {
    stock_id: number;
    supply_id: number;
    supplier_id: number | null;
    department_id: number | null;
    quantity_on_hand: number;
    unit_cost: string;
    total_cost: string;
    expiry_date: string | null;
    status: StockStatus;
    fund_cluster: string | null;
    days_to_consume: number | null;
    remarks: string | null;
    supply?: Supply | null;
    supplier?: Supplier | null;
    department?: Department | null;
    dynamic_status?:
        | 'available'
        | 'low_stock'
        | 'depleted'
        | 'expired'
        | 'reserved';
    status_display?: string;
    created_at?: string | null;
    updated_at?: string | null;
};

export type TransactionType = 'receipt' | 'issue' | 'adjustment';

export type SupplyTransaction = {
    transaction_id: number;
    supply_id: number;
    transaction_type: TransactionType;
    transaction_date: string;
    reference_no: string;
    quantity: number;
    unit_cost: string;
    total_cost: string;
    balance_quantity: number;
    department_id: number | null;
    user_id: number;
    remarks: string | null;
    fund_cluster: string | null;
    days_to_consume: number | null;
    supply?: Supply | null;
    department?: Department | null;
    user?: Pick<AppUser, 'id' | 'name'> | null;
    created_at: string;
    updated_at: string;
};

/** One item line as the Transactions page shows it (full rows fit too). */
export type TransactionLine = Pick<
    SupplyTransaction,
    | 'transaction_id'
    | 'supply_id'
    | 'transaction_type'
    | 'transaction_date'
    | 'reference_no'
    | 'quantity'
    | 'unit_cost'
    | 'total_cost'
    | 'balance_quantity'
    | 'fund_cluster'
    | 'remarks'
    | 'created_at'
> & {
    supply?: Pick<
        Supply,
        'supply_id' | 'stock_no' | 'item_name' | 'unit_of_measurement'
    > | null;
    department?: Pick<Department, 'id' | 'name'> | null;
    user?: Pick<AppUser, 'id' | 'name'> | null;
};

/** An IAR or RIS: the item lines sharing a type and reference number. */
export type SupplyTransactionDocument = {
    key: string;
    transaction_type: TransactionType;
    reference_no: string | null;
    date_from: string;
    date_to: string;
    line_count: number;
    item_count: number;
    /** Sum of the recorded line costs. */
    total_value: number;
    recorded_at: string | null;
    multiple_divisions: boolean;
    division: string | null;
    fund_cluster: string | null;
    recorded_by: string | null;
    /** Route key of the RIS slip, for issue documents. */
    ris_key: string | null;
    lines: TransactionLine[];
};

export type RisStatus = 'draft' | 'approved' | 'posted' | 'declined';
export type SignatureType = 'esign' | 'sgd';

export type RisItem = {
    item_id: number;
    ris_id: number;
    supply_id: number;
    quantity_requested: number;
    stock_available: boolean;
    quantity_issued: number | null;
    remarks: string | null;
    supply?: Supply | null;
    total_available?: number | string;
    matching_fund_available?: number | string;
    created_at?: string | null;
    updated_at?: string | null;
};

export type RisSlip = {
    ris_id: number;
    route_key: string;
    ris_no: string;
    ris_date: string;
    entity_name: string;
    division: number;
    office: string | null;
    fund_cluster: string | null;
    responsibility_center_code: string | null;
    requested_by: number | null;
    requester_signature_type: SignatureType;
    purpose: string | null;
    status: RisStatus;
    approved_by: number | null;
    approved_at: string | null;
    approver_signature_type: SignatureType;
    issued_by: number | null;
    issued_at: string | null;
    issuer_signature_type: SignatureType;
    received_by: number | null;
    received_at: string | null;
    receiver_signature_type: SignatureType;
    declined_by: number | null;
    declined_at: string | null;
    decline_reason: string | null;
    is_manual_entry: boolean;
    reference_source: string | null;
    manual_entry_by: number | null;
    manual_entry_at: string | null;
    manual_entry_notes: string | null;
    department?: Department | null;
    requester?: AppUser | null;
    approver?: AppUser | null;
    issuer?: AppUser | null;
    receiver?: AppUser | null;
    decliner?: AppUser | null;
    items?: RisItem[];
    /** E-signatures frozen at signing (loaded on the RIS page). */
    signatures?: RisSlipSignature[];
    created_at: string;
    updated_at: string;
};

export type PropertyImage = {
    id: number;
    property_id: number;
    file_path: string;
    url: string;
};

export type Property = {
    id: number;
    property_number: string;
    item_name: string;
    item_description: string | null;
    serial_no: string | null;
    model_no: string | null;
    acquisition_date: string | null;
    acquisition_cost: string | null;
    unit_of_measure: string | null;
    quantity_per_physical_count: number;
    fund: string | null;
    location_id: number;
    user_id: number;
    condition: string;
    remarks: string | null;
    active: boolean | number;
    excluded: boolean | number;
    images?: PropertyImage[];
    user?: AppUser | null;
    location?: Location | null;
    created_at: string | null;
    updated_at: string | null;
};

/** A user option for assignment selects (property MR). */
export type UserOption = {
    id: number;
    name: string;
    email: string;
    status: boolean;
    department: string | null;
    designation: string | null;
};

/** Laravel LengthAwarePaginator serialized to JSON. */
export type Paginated<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    first_page_url: string;
    last_page_url: string;
    next_page_url: string | null;
    prev_page_url: string | null;
    path: string;
    links: PaginationLink[];
};

export type PaginationLink = {
    url: string | null;
    label: string;
    active: boolean;
    page?: number | null;
};
