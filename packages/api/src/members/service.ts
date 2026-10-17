import type { AxiosInstance } from 'axios';
import type { ServerMember } from './types';

export const createMembersService = (apiClient: AxiosInstance) => ({
    /**
     * Lists the members of a server with the roles each one has.
     *
     * Being a member is enough: the backend does not ask for MANAGE_ROLES to
     * read this, only to change it.
     */
    listMembers: (serverId: string): Promise<ServerMember[]> =>
        apiClient
            .get<ServerMember[]>(`/api/v1/servers/${serverId}/members/`)
            .then(r => r.data),
});
