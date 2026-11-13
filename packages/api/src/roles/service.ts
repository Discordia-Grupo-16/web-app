import type { AxiosInstance } from 'axios';
import type { Role } from './types';

export const createRolesService = (apiClient: AxiosInstance) => ({
    createRole: (serverId: string, name: string): Promise<Role> => {
        const form = new FormData();
        form.append('name', name);
        return apiClient.post<{ data: Role }>(`/api/v1/servers/${serverId}/roles/`, form).then(r => r.data.data);
    },

    listRoles: (serverId: string): Promise<Role[]> =>
        apiClient.get<{ data: Role[] }>(`/api/v1/servers/${serverId}/roles/`).then(r => r.data.data),

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
            .patch<{ data: Role }>(`/api/v1/servers/${serverId}/roles/${roleId}`, { permissions })
            .then(r => r.data.data),

    /**
     * Marks the role as the one new members receive (SCRUM-63).
     *
     * Exclusive: the previous default is unmarked by the backend in the same
     * transaction, so there is nothing to undo here. Idempotent as well.
     */
    setDefaultRole: (serverId: string, roleId: string): Promise<void> =>
        apiClient
            .put(`/api/v1/servers/${serverId}/roles/${roleId}/default`)
            .then(() => undefined),

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

    /**
     * Deletes the role and its assignments (SCRUM-64). Rejects with 403, 404 or 409: a 404 means
     * the role no longer exists, which the caller takes as done.
     */
    deleteRole: (serverId: string, roleId: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}/roles/${roleId}`).then(() => undefined),
});
