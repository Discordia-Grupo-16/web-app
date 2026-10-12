import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createMembersService } from './service';
import type { ServerMember } from './types';

const member: ServerMember = {
    user_id: 'u1',
    joined_at: '2026-10-01T00:00:00Z',
    roles: [],
};

const setup = () => {
    const apiClient = { get: vi.fn(async () => ({ data: [member] })) };
    return { apiClient, service: createMembersService(apiClient as unknown as AxiosInstance) };
};

describe('createMembersService listMembers', () => {
    it('asks for the members of the given server', async () => {
        const { apiClient, service } = setup();

        const members = await service.listMembers('srv');

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/srv/members/');
        expect(members).toEqual([member]);
    });
});
