export type AdminUserStatus = 'active' | 'suspended';

export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'staff';
    status: AdminUserStatus;
    createdAt: string;
}

export interface PaginationMeta {
    total: number;
    limit: number;
    offset: number;
}

export interface AdminUserListResponse {
    data: AdminUser[];
    meta: PaginationMeta;
}

export interface ListAdminUsersParams {
    search?: string;
    status?: AdminUserStatus;
    limit?: number;
    offset?: number;
}
