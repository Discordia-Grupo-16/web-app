import { api } from './api.web';
import type { Channel } from '../types/channel';

export const createChannel = (serverId: string, name: string, type: 'text' | 'voice' = 'text'): Promise<Channel> => {
    const form = new FormData();
    form.append('name', name);
    form.append('type', type);
    return api.post<Channel>(`/api/v1/servers/${serverId}/channels/`, form).then(r => r.data);
};

export const updateChannel = (serverId: string, channelId: string, name?: string, topic?: string): Promise<Channel> => {
    const form = new FormData();
    if (name !== undefined) form.append('name', name);
    if (topic !== undefined) form.append('topic', topic);
    return api.patch<Channel>(`/api/v1/servers/${serverId}/channels/${channelId}`, form).then(r => r.data);
};

export const deleteChannel = (serverId: string, channelId: string): Promise<void> =>
    api.delete(`/api/v1/servers/${serverId}/channels/${channelId}`).then(() => undefined);
