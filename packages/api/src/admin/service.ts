import type { AxiosInstance, GenericAbortSignal } from 'axios';
import type { AdminUserListResponse, ListAdminUsersParams } from './types';

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
});
