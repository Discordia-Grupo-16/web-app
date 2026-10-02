import type { AxiosInstance } from 'axios';
import type { Server } from './types';

export const createServersService = (apiClient: AxiosInstance) => ({
    getServers: (): Promise<Server[]> =>
        apiClient.get<Server[]>('/api/v1/servers/').then(r => r.data),

    getServer: (serverId: string): Promise<Server> =>
        apiClient.get<Server>(`/api/v1/servers/${serverId}`).then(r => r.data),

    // Blob instead of File: React Native has no File, and File is a Blob on the web.
    createServer: (name: string, description?: string, icon?: Blob): Promise<Server> => {
        const form = new FormData();
        form.append('name', name);
        if (description) form.append('description', description);
        if (icon) form.append('icon', icon);
        return apiClient.post<Server>('/api/v1/servers/', form).then(r => r.data);
    },

    deleteServer: (serverId: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}`).then(() => undefined),

    leaveServer: (serverId: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}/members/me`).then(() => undefined),
});
