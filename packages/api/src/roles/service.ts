import type { AxiosInstance } from 'axios';
import type { Role } from './types';

export const createRolesService = (apiClient: AxiosInstance) => ({
    createRole: (serverId: string, name: string): Promise<Role> => {
        const form = new FormData();
        form.append('name', name);
        return apiClient.post<Role>(`/api/v1/servers/${serverId}/roles/`, form).then(r => r.data);
    },

    listRoles: (serverId: string): Promise<Role[]> =>
        apiClient.get<Role[]>(`/api/v1/servers/${serverId}/roles/`).then(r => r.data),

    /**
     * Replaces a role's permissions with the given list.
     *
     * This one goes as JSON and not as a form, unlike the rest of this
     * service: it is what the endpoint expects, because a list of names in
     * `multipart/form-data` is brittle to build and to read.
     *
     * Names are sent rather than the number so that an unknown permission is
     * rejected by the backend instead of ignored: a typo must not leave the
     * role with fewer permissions than were meant for it.
     */
    updateRolePermissions: (
        serverId: string,
        roleId: string,
        permissions: readonly string[],
    ): Promise<Role> =>
        apiClient
            .patch<Role>(`/api/v1/servers/${serverId}/roles/${roleId}`, { permissions })
            .then(r => r.data),

    /** Gives the role to a member. Repeating it neither fails nor duplicates. */
    assignRole: (serverId: string, roleId: string, userId: string): Promise<void> =>
        apiClient
            .put(`/api/v1/servers/${serverId}/roles/${roleId}/members/${userId}`)
            .then(() => undefined),

    /**
     * Takes the role away from a member.
     *
     * What their other roles grant is kept: the effective permission is the OR
     * of all of them. Removing a role they do not have does not fail either.
     */
    removeRole: (serverId: string, roleId: string, userId: string): Promise<void> =>
        apiClient
            .delete(`/api/v1/servers/${serverId}/roles/${roleId}/members/${userId}`)
            .then(() => undefined),
});
