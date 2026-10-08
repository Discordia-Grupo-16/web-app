import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createServersService } from './service';
import type { Server } from './types';

const server: Server = {
    id: 'srv',
    name: 'Discordia',
    description: null,
    owner_id: 'owner',
    avatar_url: null,
    created_at: '2026-10-01T00:00:00Z',
    channels: [],
};

const setup = () => {
    const apiClient = { get: vi.fn(async () => ({ data: [server] })) };
    return { apiClient, service: createServersService(apiClient as unknown as AxiosInstance) };
};

describe('createServersService getServers', () => {
    it('lists the own servers without query params', async () => {
        const { apiClient, service } = setup();

        const servers = await service.getServers();

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/', { params: undefined });
        expect(servers).toEqual([server]);
    });

    it('narrows the list to the servers shared with a user', async () => {
        const { apiClient, service } = setup();

        await service.getServers({ withUser: 'user-1' });

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/', { params: { withUser: 'user-1' } });
    });
});
