import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createInvitationsService } from './service';
import type { Invitation, Member } from './types';

const invitation: Invitation = {
    id: 'inv-1',
    server_id: 'srv',
    code: 'ABC123',
    created_by: 'user-1',
    expires_at: null,
    max_uses: null,
    uses: 0,
    created_at: '2026-10-01T00:00:00Z',
};

const member: Member = {
    id: 'mem-1',
    server_id: 'srv',
    user_id: 'user-1',
    joined_at: '2026-10-01T00:00:00Z',
};

const setup = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: { data: [invitation] } })),
        post: vi.fn(async () => ({ data: { data: invitation } })),
        delete: vi.fn(async () => ({ data: undefined })),
    };
    return { apiClient, service: createInvitationsService(apiClient as unknown as AxiosInstance) };
};

describe('createInvitation', () => {
    it('posts to the server invitations endpoint', async () => {
        const { apiClient, service } = setup();

        await service.createInvitation('srv');

        expect(apiClient.post).toHaveBeenCalledWith(
            '/api/v1/servers/srv/invitations/',
            expect.any(FormData),
        );
    });

    it('returns the created invitation', async () => {
        const { service } = setup();

        const result = await service.createInvitation('srv');

        expect(result).toEqual(invitation);
    });
});

describe('listInvitations', () => {
    it('gets the server invitations endpoint', async () => {
        const { apiClient, service } = setup();

        await service.listInvitations('srv');

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/srv/invitations/');
    });

    it('returns the list of invitations', async () => {
        const { service } = setup();

        const result = await service.listInvitations('srv');

        expect(result).toEqual([invitation]);
    });
});

describe('revokeInvitation', () => {
    it('deletes the invitation endpoint', async () => {
        const { apiClient, service } = setup();

        await service.revokeInvitation('srv', 'ABC123');

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/servers/srv/invitations/ABC123');
    });

    it('returns no body', async () => {
        const { service } = setup();

        await expect(service.revokeInvitation('srv', 'ABC123')).resolves.toBeUndefined();
    });
});

describe('joinServer', () => {
    it('posts to the accept endpoint', async () => {
        const { apiClient, service } = setup();
        apiClient.post.mockResolvedValueOnce({ data: { data: member } });

        await service.joinServer('ABC123');

        expect(apiClient.post).toHaveBeenCalledWith('/api/v1/invites/ABC123/accept');
    });

    it('returns the membership', async () => {
        const { apiClient, service } = setup();
        apiClient.post.mockResolvedValueOnce({ data: { data: member } });

        const result = await service.joinServer('ABC123');

        expect(result).toEqual(member);
    });
});
