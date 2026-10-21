import type { AxiosInstance } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { createRolesService } from './service';
import type { Role } from './types';

const role: Role = {
    id: 'role-1',
    server_id: 'srv',
    name: 'Moderador',
    is_default: false,
    permissions: 3,
    permission_names: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
    position: 1,
    created_at: '2026-10-01T00:00:00Z',
};

const setup = () => {
    const apiClient = {
        get: vi.fn(async () => ({ data: [role] })),
        post: vi.fn(async () => ({ data: role })),
        patch: vi.fn(async () => ({ data: role })),
        put: vi.fn(async () => ({ data: undefined })),
        delete: vi.fn(async () => ({ data: undefined })),
    };
    return { apiClient, service: createRolesService(apiClient as unknown as AxiosInstance) };
};

describe('updateRolePermissions', () => {
    it('sends the permissions by name and as JSON', () => {
        // The endpoint expects JSON, not a form like the rest of the service.
        const { apiClient, service } = setup();

        service.updateRolePermissions('srv', 'role-1', ['VIEW_CHANNEL', 'SEND_MESSAGES']);

        expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/servers/srv/roles/role-1', {
            permissions: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
        });
    });

    it('returns the updated role', async () => {
        const { service } = setup();

        const updated = await service.updateRolePermissions('srv', 'role-1', ['VIEW_CHANNEL']);

        expect(updated).toEqual(role);
    });

    it('allows leaving a role with no permission at all', async () => {
        const { apiClient, service } = setup();

        await service.updateRolePermissions('srv', 'role-1', []);

        expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/servers/srv/roles/role-1', {
            permissions: [],
        });
    });
});

describe('assignRole and removeRole', () => {
    it('gives the role to the member', async () => {
        const { apiClient, service } = setup();

        await service.assignRole('srv', 'role-1', 'user-1');

        expect(apiClient.put).toHaveBeenCalledWith(
            '/api/v1/servers/srv/roles/role-1/members/user-1',
        );
    });

    it('takes the role away from the member', async () => {
        const { apiClient, service } = setup();

        await service.removeRole('srv', 'role-1', 'user-1');

        expect(apiClient.delete).toHaveBeenCalledWith(
            '/api/v1/servers/srv/roles/role-1/members/user-1',
        );
    });

    it('neither returns a body', async () => {
        const { service } = setup();

        await expect(service.assignRole('srv', 'r', 'u')).resolves.toBeUndefined();
        await expect(service.removeRole('srv', 'r', 'u')).resolves.toBeUndefined();
    });
});

describe('what was already there', () => {
    it('still lists the roles of the server', async () => {
        const { apiClient, service } = setup();

        const roles = await service.listRoles('srv');

        expect(apiClient.get).toHaveBeenCalledWith('/api/v1/servers/srv/roles/');
        expect(roles).toEqual([role]);
    });
});

describe('setDefaultRole', () => {
    it('marks the role as the default of the server', async () => {
        const { apiClient, service } = setup();

        await service.setDefaultRole('srv', 'role-1');

        expect(apiClient.put).toHaveBeenCalledWith(
            '/api/v1/servers/srv/roles/role-1/default',
        );
    });

    it('returns no body: the backend unmarks the previous one on its own', async () => {
        const { service } = setup();

        await expect(service.setDefaultRole('srv', 'role-1')).resolves.toBeUndefined();
    });
});
