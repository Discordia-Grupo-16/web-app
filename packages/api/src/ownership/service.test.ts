import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createOwnershipService } from './service';
import type { OwnershipTransfer } from './types';

const transfer: OwnershipTransfer = {
    server_id: 'srv',
    server_name: 'Grupo 16',
    from_user_id: 'owner',
    to_user_id: 'member',
    status: 'pending',
    created_at: '2026-11-05T00:00:00Z',
    resolved_at: null,
};

const setup = () => {
    const apiClient = {
        get: vi.fn(async (url: string) => ({
            data: { data: url.endsWith('/users/me/ownership-transfers') ? [transfer] : transfer },
        })),
        post: vi.fn(async () => ({ data: { data: transfer } })),
        delete: vi.fn(async () => ({ data: undefined })),
    };
    return { apiClient, service: createOwnershipService(apiClient as unknown as AxiosInstance) };
};

describe('createOwnershipService', () => {
    it('reads the last transfer of a server out of the envelope', async () => {
        const { apiClient, service } = setup();

        const result = await service.getServerTransfer('srv');

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/srv/ownership-transfer');
        expect(result).toEqual(transfer);
    });

    it('proposes to a member with the recipient in snake_case', async () => {
        const { apiClient, service } = setup();

        const result = await service.proposeTransfer('srv', 'member');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/servers/srv/ownership-transfer', {
            to_user_id: 'member',
        });
        expect(result).toEqual(transfer);
    });

    it('cancels with a DELETE on the transfer of the server', async () => {
        const { apiClient, service } = setup();

        await expect(service.cancelTransfer('srv')).resolves.toBeUndefined();

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/servers/srv/ownership-transfer');
    });

    it('accepts and rejects on their own subresources', async () => {
        const { apiClient, service } = setup();

        await expect(service.acceptTransfer('srv')).resolves.toBeUndefined();
        await expect(service.rejectTransfer('srv')).resolves.toBeUndefined();

        expect(apiClient.post).toHaveBeenNthCalledWith(1, '/api/v1/servers/srv/ownership-transfer/acceptance');
        expect(apiClient.post).toHaveBeenNthCalledWith(2, '/api/v1/servers/srv/ownership-transfer/rejection');
    });

    it('lists the transfers waiting for my answer out of the envelope', async () => {
        const { apiClient, service } = setup();

        const result = await service.listMyTransfers();

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/users/me/ownership-transfers');
        expect(result).toEqual([transfer]);
    });
});
