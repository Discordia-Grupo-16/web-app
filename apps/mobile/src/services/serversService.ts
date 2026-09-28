import { api } from '@/services/api';
import type { Server } from '@/types/server';

export const getServers = (): Promise<Server[]> =>
    api.get<Server[]>('/api/v1/servers/').then(r => r.data);

export const getServer = (serverId: string): Promise<Server> =>
    api.get<Server>(`/api/v1/servers/${serverId}`).then(r => r.data);

export const createServer = (name: string, description?: string): Promise<Server> => {
    const form = new FormData();
    form.append('name', name);
    if (description) form.append('description', description);
    return api.post<Server>('/api/v1/servers/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
};

export const deleteServer = (serverId: string): Promise<void> =>
    api.delete(`/api/v1/servers/${serverId}`).then(() => undefined);

export const leaveServer = (serverId: string): Promise<void> =>
    api.delete(`/api/v1/servers/${serverId}/members/me`).then(() => undefined);
