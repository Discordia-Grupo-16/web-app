import type { AxiosInstance } from 'axios';
import type { Role } from './types';

export const createRolesService = (apiClient: AxiosInstance) => ({
    createRole: (serverId: string, name: string): Promise<Role> => {
        const form = new FormData();
        form.append('name', name);
        return apiClient.post<Role>(`/api/v1/servers/${serverId}/roles/`, form).then(r => r.data);
    },

    listRoles: (serverId: string): Promise<Role[]> =>
        apiClient.get<Role[]>(`/api/v1/servers/${serverId}/roles/`).then(r => r.data),
});
