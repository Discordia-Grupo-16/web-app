import type { AxiosInstance } from 'axios';
import type { Channel } from './types';

export const createChannelsService = (apiClient: AxiosInstance) => ({
    createChannel: (serverId: string, name: string, type: 'text' | 'voice' = 'text'): Promise<Channel> => {
        const form = new FormData();
        form.append('name', name);
        form.append('type', type);
        return apiClient.post<Channel>(`/api/v1/servers/${serverId}/channels/`, form).then(r => r.data);
    },

    updateChannel: (serverId: string, channelId: string, name?: string, topic?: string): Promise<Channel> => {
        const form = new FormData();
        if (name !== undefined) form.append('name', name);
        if (topic !== undefined) form.append('topic', topic);
        return apiClient.patch<Channel>(`/api/v1/servers/${serverId}/channels/${channelId}`, form).then(r => r.data);
    },

    deleteChannel: (serverId: string, channelId: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}/channels/${channelId}`).then(() => undefined),
});
