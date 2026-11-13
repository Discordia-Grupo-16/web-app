import type { AxiosInstance } from 'axios';
import type { Server } from './types';

export const createServersService = (apiClient: AxiosInstance) => ({
    // withUser narrows the list to the servers shared with that user (public profile, SCRUM-26).
    getServers: (options: { withUser?: string } = {}): Promise<Server[]> =>
        apiClient
            .get<{ data: Server[] }>('/api/v1/servers/', { params: options.withUser ? { withUser: options.withUser } : undefined })
            .then(r => r.data.data),

    getServer: (serverId: string): Promise<Server> =>
        apiClient.get<{ data: Server }>(`/api/v1/servers/${serverId}`).then(r => r.data.data),

    // Blob instead of File: React Native has no File, and File is a Blob on the web.
    createServer: (name: string, description?: string, icon?: Blob): Promise<Server> => {
        const form = new FormData();
        form.append('name', name);
        if (description) form.append('description', description);
        if (icon) form.append('icon', icon);
        return apiClient.post<{ data: Server }>('/api/v1/servers/', form).then(r => r.data.data);
    },

    updateServer: (serverId: string, options: { name?: string; description?: string; icon?: Blob; banner?: Blob }): Promise<Server> => {
        const form = new FormData();
        if (options.name !== undefined) form.append('name', options.name);
        if (options.description !== undefined) form.append('description', options.description);
        if (options.icon) form.append('icon', options.icon);
        if (options.banner) form.append('banner', options.banner);
        return apiClient.patch<{ data: Server }>(`/api/v1/servers/${serverId}`, form).then(r => r.data.data);
    },

    deleteServer: (serverId: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}`).then(() => undefined),

    leaveServer: (serverId: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}/members/me`).then(() => undefined),
});
