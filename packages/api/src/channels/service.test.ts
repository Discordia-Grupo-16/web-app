import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createChannelsService } from './service';
import type { Channel } from './types';

const channel: Channel = {
    id: 'ch-1',
    server_id: 'srv',
    category_id: null,
    name: 'general',
    type: 'text',
    topic: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
};

const setup = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: { data: [channel] } })),
        post: vi.fn(async () => ({ data: { data: channel } })),
        patch: vi.fn(async () => ({ data: { data: channel } })),
        delete: vi.fn(async () => ({ data: undefined })),
    };
    return { apiClient, service: createChannelsService(apiClient as unknown as AxiosInstance) };
};

describe('createChannel', () => {
    it('posts to the server channels endpoint', async () => {
        const { apiClient, service } = setup();

        await service.createChannel('srv', 'general');

        expect(apiClient.post).toHaveBeenCalledWith(
            '/api/v1/servers/srv/channels/',
            expect.any(FormData),
        );
    });

    it('returns the created channel', async () => {
        const { service } = setup();

        const result = await service.createChannel('srv', 'general');

        expect(result).toEqual(channel);
    });
});

describe('updateChannel', () => {
    it('patches the channel endpoint', async () => {
        const { apiClient, service } = setup();

        await service.updateChannel('srv', 'ch-1', 'nuevo nombre');

        expect(apiClient.patch).toHaveBeenCalledWith(
            '/api/v1/servers/srv/channels/ch-1',
            expect.any(FormData),
        );
    });

    it('returns the updated channel', async () => {
        const { service } = setup();

        const result = await service.updateChannel('srv', 'ch-1', 'nuevo nombre');

        expect(result).toEqual(channel);
    });
});

describe('deleteChannel', () => {
    it('deletes the channel endpoint', async () => {
        const { apiClient, service } = setup();

        await service.deleteChannel('srv', 'ch-1');

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/servers/srv/channels/ch-1');
    });

    it('returns no body', async () => {
        const { service } = setup();

        await expect(service.deleteChannel('srv', 'ch-1')).resolves.toBeUndefined();
    });
});
