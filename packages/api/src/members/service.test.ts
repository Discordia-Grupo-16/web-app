import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMembersService } from './service';
import type { ServerBan, ServerMember } from './types';

const member: ServerMember = {
    user_id: 'u1',
    joined_at: '2026-10-01T00:00:00Z',
    roles: [],
};

const setup = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: [member] })),
        put: vi.fn(async () => ({ data: undefined })),
        delete: vi.fn(async () => ({ data: undefined })),
    };
    return { apiClient, service: createMembersService(apiClient as unknown as AxiosInstance) };
};

const sentForm = (apiClient: { put: ReturnType<typeof vi.fn> }) =>
    apiClient.put.mock.calls[0][1] as FormData;

describe('createMembersService listMembers', () => {
    it('asks for the members of the given server', async () => {
        const { apiClient, service } = setup();

        const members = await service.listMembers('srv');

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/srv/members/');
        expect(members).toEqual([member]);
    });
});

describe('createMembersService banMember', () => {
    it('puts to the bans path of the server', async () => {
        const { apiClient, service } = setup();

        await service.banMember('srv', 'u1');

        expect(apiClient.put).toHaveBeenCalledWith('/api/v1/servers/srv/bans/u1', expect.any(FormData));
    });

    it('sends the reason when there is one', async () => {
        const { apiClient, service } = setup();

        await service.banMember('srv', 'u1', 'spam');

        expect(sentForm(apiClient).get('reason')).toBe('spam');
    });

    it('omits a blank reason instead of sending an empty field', async () => {
        // The backend stores a blank reason as absent, but sending it would make
        // the record say the moderator typed something when they did not.
        const { apiClient, service } = setup();

        await service.banMember('srv', 'u1', '   ');

        expect(sentForm(apiClient).has('reason')).toBe(false);
    });
});

describe('createMembersService kickMember', () => {
    it('deletes the member path of the server', async () => {
        const { apiClient, service } = setup();

        await service.kickMember('srv', 'u1');

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/servers/srv/members/u1');
    });
});

describe('createMembersService listBans', () => {
    it('asks for the bans of the given server and returns them', async () => {
        const ban: ServerBan = {
            user_id: 'u1',
            banned_by: 'u2',
            reason: null,
            created_at: '2026-10-01T00:00:00Z',
        };
        const apiClient = { get: vi.fn(async () => ({ data: [ban] })) };
        const service = createMembersService(apiClient as unknown as AxiosInstance);

        const bans = await service.listBans('srv');

        // The trailing slash is part of the route: the gateway does not answer without it.
        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/srv/bans/');
        expect(bans).toEqual([ban]);
    });
});

describe('createMembersService revokeBan', () => {
    it('deletes the ban path of the server', async () => {
        const { apiClient, service } = setup();

        await service.revokeBan('srv', 'u1');

        expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/servers/srv/bans/u1');
    });
});
