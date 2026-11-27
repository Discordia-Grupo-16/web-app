import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createPresenceService } from './service';
import type { MemberPresence } from './types';

const online: MemberPresence = { userId: 'u1', status: 'online', updatedAt: '2026-11-23T12:00:00Z' };

const setup = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: { data: [online] } })),
        put: vi.fn(async () => ({ status: 204, data: '' })),
    };
    return { apiClient, service: createPresenceService(apiClient as unknown as AxiosInstance) };
};

describe('createPresenceService', () => {
    it('getServerPresence asks for the members of the server and unwraps data', async () => {
        const { apiClient, service } = setup();

        const result = await service.getServerPresence('s1');

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/s1/presence');
        expect(result).toEqual([online]);
    });

    it.each(['dnd', 'invisible', null] as const)('setManual puts %s and resolves with nothing', async (manual) => {
        const { apiClient, service } = setup();

        await expect(service.setManual(manual)).resolves.toBeUndefined();

        expect(apiClient.put).toHaveBeenCalledWith('/api/v1/users/me/presence', { manual });
    });
});
