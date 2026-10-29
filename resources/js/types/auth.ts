import type { Department, Designation, Role } from './models';

export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
    role: Role;
    status: boolean | number;
    department_id: number | null;
    designation_id: number | null;
    department?: Pick<Department, 'id' | 'name'> | null;
    designation?: Pick<Designation, 'id' | 'name'> | null;
    profile_photo_url: string;
    signature_path?: string | null;
    signature_url?: string | null;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
    /** The old single role (admin, cao or staff), kept in sync with `roles`. */
    role: Role | null;
    /** Names of the user's roles. */
    roles: string[];
    /** Permission slugs the user's roles give (all of them for a super admin). */
    permissions: string[];
    isSuperAdmin: boolean;
    /** Admin/CAO temporarily using the staff screens to request supplies. */
    isAdminUserMode: boolean;
    originalRole: string | null;
};

export type NotificationCounts = {
    approved_requests_count: number;
    pending_receipt_count: number;
    draft_count?: number;
    approved_count?: number;
};

export type BroadcastingConfig = {
    enabled: boolean;
    key: string | null;
    cluster: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
