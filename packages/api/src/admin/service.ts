import type { AxiosInstance, GenericAbortSignal } from 'axios';
import type { AdminUser, AdminUserListResponse, ListAdminUsersParams } from './types';

// Drops what carries no filter: undefined keys and a blank search. The backend treats a blank
// search as "no filter" too, but not sending it keeps the URL and the request log clean.
const cleanParams = (params: ListAdminUsersParams): ListAdminUsersParams => {
    const cleaned: ListAdminUsersParams = {};
    if (params.search !== undefined && params.search.trim() !== '') cleaned.search = params.search;
    if (params.status !== undefined) cleaned.status = params.status;
    if (params.limit !== undefined) cleaned.limit = params.limit;
    if (params.offset !== undefined) cleaned.offset = params.offset;
    return cleaned;
};

export const createAdminUserService = (apiClient: AxiosInstance) => ({
    // Resolves to the whole body ({ data, meta }): the screen needs meta.total to paginate.
    async listUsers(params: ListAdminUsersParams = {}, signal?: GenericAbortSignal): Promise<AdminUserListResponse> {
        const { data } = await apiClient.get<AdminUserListResponse>('/api/v1/admin/users', {
            params: cleanParams(params),
            signal,
        });
        return data;
    },

    // Resolves to the updated user (unwrapped from { data }): the screen reloads the list from it.
    async suspendUser(userId: string): Promise<AdminUser> {
        const res = await apiClient.post<{ data: AdminUser }>(`/api/v1/admin/users/${userId}/suspension`);
        return res.data.data;
    },

    // Same resource as suspendUser, opposite verb: DELETE lifts the suspension.
    async reactivateUser(userId: string): Promise<AdminUser> {
        const res = await apiClient.delete<{ data: AdminUser }>(`/api/v1/admin/users/${userId}/suspension`);
        return res.data.data;
    },
});
