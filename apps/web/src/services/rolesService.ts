import { api } from './api.web';
import type { Role } from '../types/role';

export const createRole = (serverId: string, name: string): Promise<Role> => {
    const form = new FormData();
    form.append('name', name);
    return api.post<Role>(`/api/v1/servers/${serverId}/roles/`, form).then(r => r.data);
};

export const listRoles = (serverId: string): Promise<Role[]> =>
    api.get<Role[]>(`/api/v1/servers/${serverId}/roles/`).then(r => r.data);
