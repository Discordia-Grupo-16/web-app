import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createAdminUserService } from './service';
import type { AdminUserListResponse } from './types';

const page: AdminUserListResponse = {
    data: [
        {
            id: 'u1',
            email: 'ana@example.com',
            name: 'Ana',
            role: 'user',
            status: 'suspended',
            createdAt: '2026-10-01T00:00:00',
        },
    ],
    meta: { total: 1, limit: 20, offset: 0 },
};

const setup = () => {
    const apiClient = { get: vi.fn(async () => ({ data: page })) };
    return { apiClient, service: createAdminUserService(apiClient as unknown as AxiosInstance) };
};

describe('createAdminUserService listUsers', () => {
    it('calls GET /api/v1/admin/users with the params and the abort signal', async () => {
        const { apiClient, service } = setup();
        const { signal } = new AbortController();

        await service.listUsers({ search: 'ana', status: 'suspended', limit: 20, offset: 40 }, signal);

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/users', {
            params: { search: 'ana', status: 'suspended', limit: 20, offset: 40 },
            signal,
        });
    });

    it('does not send a blank search nor undefined keys', async () => {
        const { apiClient, service } = setup();

        await service.listUsers({ search: '   ', status: undefined, limit: 20, offset: 0 });

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/users', {
            params: { limit: 20, offset: 0 },
            signal: undefined,
        });
    });

    it('returns the whole body with data and meta', async () => {
        const { service } = setup();

        const result = await service.listUsers({ limit: 20, offset: 0 });

        expect(result).toEqual(page);
    });
});
