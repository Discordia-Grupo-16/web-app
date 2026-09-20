import { api } from '@/services/api';
import type { Role } from '@/types/role';

export const createRole = (serverId: string, name: string): Promise<Role> => {
    const form = new FormData();
    form.append('name', name);
    return api.post<Role>(`/servers/${serverId}/roles/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
};

export const listRoles = (serverId: string): Promise<Role[]> =>
    api.get<Role[]>(`/servers/${serverId}/roles/`).then(r => r.data);
