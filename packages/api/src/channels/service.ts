import type { AxiosInstance } from 'axios';
import type { Channel } from './types';

export const createChannelsService = (apiClient: AxiosInstance) => ({
    createChannel: (serverId: string, name: string, type: 'text' | 'voice' = 'text', categoryId?: string): Promise<Channel> => {
        const form = new FormData();
        form.append('name', name);
        form.append('type', type);
        if (categoryId !== undefined) form.append('category_id', categoryId);
        return apiClient.post<{ data: Channel }>(`/api/v1/servers/${serverId}/channels/`, form).then(r => r.data.data);
    },

    updateChannel: (serverId: string, channelId: string, name?: string, topic?: string, categoryId?: string): Promise<Channel> => {
        const form = new FormData();
        if (name !== undefined) form.append('name', name);
        if (topic !== undefined) form.append('topic', topic);
        if (categoryId !== undefined) form.append('category_id', categoryId);
        return apiClient.patch<{ data: Channel }>(`/api/v1/servers/${serverId}/channels/${channelId}`, form).then(r => r.data.data);
    },

    deleteChannel: (serverId: string, channelId: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}/channels/${channelId}`).then(() => undefined),

    reorderChannels: (serverId: string, order: string[]): Promise<void> =>
        apiClient.post(`/api/v1/servers/${serverId}/channels/reorder`, order).then(() => undefined),
});
