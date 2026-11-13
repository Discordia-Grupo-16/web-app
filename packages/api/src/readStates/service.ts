import type { AxiosInstance } from 'axios';
import type { ChannelUnread, ReadState } from './types';

export const createReadStatesService = (apiClient: AxiosInstance) => ({
    getUnread: (): Promise<ChannelUnread[]> =>
        apiClient.get<{ data: ChannelUnread[] }>('/api/v1/users/me/unread').then(r => r.data.data),

    /** Responde el estado vigente, que puede ser más nuevo que el pedido. */
    markRead: (channelId: string, messageId: string): Promise<ReadState> =>
        apiClient
            .put<{ data: ReadState }>(`/api/v1/channels/${channelId}/read`, { messageId })
            .then(r => r.data.data),

    /** Responde solo los canales que cambiaron. */
    markAllRead: (): Promise<ReadState[]> =>
        apiClient.put<{ data: ReadState[] }>('/api/v1/users/me/read-all').then(r => r.data.data),
});

export type ReadStatesService = ReturnType<typeof createReadStatesService>;
