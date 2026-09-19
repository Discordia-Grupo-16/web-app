import { api } from './api.web';
import type { Server } from '../types/server';

export const getServers = (): Promise<Server[]> =>
    api.get<Server[]>('/servers/').then(r => r.data);

export const getServer = (serverId: string): Promise<Server> =>
    api.get<Server>(`/servers/${serverId}`).then(r => r.data);

export const createServer = (name: string, description?: string, icon?: File): Promise<Server> => {
    const form = new FormData();
    form.append('name', name);
    if (description) form.append('description', description);
    if (icon) form.append('icon', icon);
    return api.post<Server>('/servers/', form).then(r => r.data);
};

export const deleteServer = (serverId: string): Promise<void> =>
    api.delete(`/servers/${serverId}`).then(() => undefined);

export const leaveServer = (serverId: string): Promise<void> =>
    api.delete(`/servers/${serverId}/members/me`).then(() => undefined);
