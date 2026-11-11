import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createAdminServerService, createAdminUserService } from './service';
import type { AdminServerListResponse, AdminUser, AdminUserListResponse } from './types';

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

const suspended: AdminUser = { ...page.data[0], status: 'suspended' };
const reactivated: AdminUser = { ...page.data[0], status: 'active' };

const serverPage: AdminServerListResponse = {
    data: [
        {
            id: 's1',
            name: 'Discordia',
            memberCount: 42,
            createdAt: '2026-10-01T00:00:00',
        },
    ],
    meta: { total: 1, limit: 20, offset: 0 },
};

const setup = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: page })),
        post: vi.fn(async () => ({ data: { data: suspended } })),
        delete: vi.fn(async () => ({ data: { data: reactivated } })),
    };
    return { apiClient, service: createAdminUserService(apiClient as unknown as AxiosInstance) };
};

const setupServer = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: serverPage })),
        delete: vi.fn(async () => undefined),
    };
    return { apiClient, service: createAdminServerService(apiClient as unknown as AxiosInstance) };
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

describe('createAdminUserService suspendUser', () => {
    it('calls POST /api/v1/admin/users/{id}/suspension with no body', async () => {
        const { apiClient, service } = setup();

        await service.suspendUser('u1');

        expect(apiClient.post).toHaveBeenCalledTimes(1);
        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/admin/users/u1/suspension');
    });

    it('returns the updated AdminUser unwrapped from { data }', async () => {
        const { service } = setup();

        const result = await service.suspendUser('u1');

        expect(result).toEqual(suspended);
    });

    it('lets the error through when the request fails', async () => {
        const { apiClient, service } = setup();
        apiClient.post.mockRejectedValueOnce(new Error('409'));

        await expect(service.suspendUser('u1')).rejects.toThrow('409');
    });
});

describe('createAdminUserService reactivateUser', () => {
    it('calls DELETE /api/v1/admin/users/{id}/suspension and nothing else', async () => {
        const { apiClient, service } = setup();

        await service.reactivateUser('u1');

        expect(apiClient.delete).toHaveBeenCalledTimes(1);
        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/admin/users/u1/suspension');
        expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('returns the updated AdminUser unwrapped from { data }', async () => {
        const { service } = setup();

        const result = await service.reactivateUser('u1');

        expect(result).toEqual(reactivated);
    });

    it('lets the error through when the request fails', async () => {
        const { apiClient, service } = setup();
        apiClient.delete.mockRejectedValueOnce(new Error('409'));

        await expect(service.reactivateUser('u1')).rejects.toThrow('409');
    });
});

describe('createAdminServerService listServers', () => {
    it('calls GET /api/v1/admin/servers with the params and the abort signal', async () => {
        const { apiClient, service } = setupServer();
        const { signal } = new AbortController();

        await service.listServers({ search: 'discordia', limit: 20, offset: 40 }, signal);

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/servers', {
            params: { search: 'discordia', limit: 20, offset: 40 },
            signal,
        });
    });

    describe('createAdminServerService deleteServer', () => {
        it('calls DELETE /api/v1/admin/servers/{id}', async () => {
            const { apiClient, service } = setupServer();

            await service.deleteServer('s1');

            expect(apiClient.delete).toHaveBeenCalledTimes(1);
            expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/admin/servers/s1');
        });

        it('resolves without a value', async () => {
            const { service } = setupServer();

            await expect(service.deleteServer('s1')).resolves.toBeUndefined();
        });

        it('lets the error through when the request fails', async () => {
            const { apiClient, service } = setupServer();
            apiClient.delete.mockRejectedValueOnce(new Error('request failed'));

            await expect(service.deleteServer('s1')).rejects.toThrow('request failed');
        });
    });

    it('does not send a blank search nor undefined keys', async () => {
        const { apiClient, service } = setupServer();

        await service.listServers({ search: '   ', limit: 20, offset: 0 });

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/admin/servers', {
            params: { limit: 20, offset: 0 },
            signal: undefined,
        });
    });

    it('returns the whole body with data and meta', async () => {
        const { service } = setupServer();

        const result = await service.listServers({ limit: 20, offset: 0 });

        expect(result).toEqual(serverPage);
    });

    it('lets the error through when the request fails', async () => {
        const { apiClient, service } = setupServer();
        apiClient.get.mockRejectedValueOnce(new Error('request failed'));

        await expect(service.listServers()).rejects.toThrow('request failed');
    });
});
