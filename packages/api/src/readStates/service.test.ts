import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createReadStatesService } from './service';
import type { ChannelUnread, ReadState } from './types';

const state: ReadState = {
    channelId: 'c1',
    serverId: 's1',
    lastReadMessageId: 'm1',
    lastReadAt: '2026-11-02T12:00:00Z',
};

const unread: ChannelUnread = {
    channelId: 'c1',
    serverId: 's1',
    lastMessageId: 'm2',
    lastMessageAt: '2026-11-02T12:01:00Z',
    lastReadMessageId: null,
    lastReadAt: null,
    unread: true,
    mentionCount: 0,
};

const setup = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: { data: [unread] } })),
        put: vi.fn(async (_url: string, _body?: unknown): Promise<{ data: { data: ReadState | ReadState[] } }> => ({
            data: { data: state },
        })),
    };
    return { apiClient, service: createReadStatesService(apiClient as unknown as AxiosInstance) };
};

describe('createReadStatesService', () => {
    it('getUnread asks for the unread state and unwraps data', async () => {
        const { apiClient, service } = setup();

        const result = await service.getUnread();

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/users/me/unread');
        expect(result).toEqual([unread]);
    });

    it('markRead puts the message id to the channel and returns the current state', async () => {
        const { apiClient, service } = setup();

        const result = await service.markRead('c1', 'm1');

        expect(apiClient.put).toHaveBeenCalledWith('/api/v1/channels/c1/read', { messageId: 'm1' });
        expect(result).toEqual(state);
    });

    it('markAllRead puts to read-all and returns the states that changed', async () => {
        const { apiClient, service } = setup();
        apiClient.put.mockResolvedValueOnce({ data: { data: [state] } });

        const result = await service.markAllRead();

        expect(apiClient.put).toHaveBeenCalledWith('/api/v1/users/me/read-all');
        expect(result).toEqual([state]);
    });
});
