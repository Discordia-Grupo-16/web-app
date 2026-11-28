import type { AxiosInstance } from 'axios';
import type { ServerBan, ServerMember, ServerMute } from './types';

export const createMembersService = (apiClient: AxiosInstance) => ({
    /**
     * Lists the members of a server with the roles each one has.
     *
     * Being a member is enough: the backend does not ask for MANAGE_ROLES to
     * read this, only to change it.
     */
    listMembers: (serverId: string): Promise<ServerMember[]> =>
        apiClient
            .get<{ data: ServerMember[] }>(`/api/v1/servers/${serverId}/members/`)
            .then(r => r.data.data),

    /**
     * Bans a member: they lose access and no invitation lets them back in
     * (SCRUM-69).
     *
     * A PUT, like the endpoint: it asserts a state rather than removing one,
     * so banning someone already banned answers the same and is safe to
     * repeat. The reason is optional and only kept in the record — it is not
     * shown to the banned user.
     */
    banMember: (serverId: string, userId: string, reason?: string): Promise<void> => {
        const form = new FormData();
        if (reason?.trim()) form.append('reason', reason.trim());
        return apiClient
            .put(`/api/v1/servers/${serverId}/bans/${userId}`, form)
            .then(() => undefined);
    },

    /**
     * Kicks a member out of a server (SCRUM-68): they lose access, but any valid
     * invitation brings them back. A DELETE without body: there is no reason to send.
     */
    kickMember: (serverId: string, userId: string): Promise<void> =>
        apiClient
            .delete(`/api/v1/servers/${serverId}/members/${userId}`)
            .then(() => undefined),

    /**
     * Mutes a member for a while (SCRUM-71): they keep seeing the channels but
     * cannot write or speak until the time is up.
     *
     * A PUT with a JSON body, like the endpoint: it asserts a state, so muting
     * someone already muted replaces the duration. The client sends a duration
     * and not a date, so the end is decided by the server's clock and the
     * answer carries it.
     */
    muteMember: (serverId: string, userId: string, durationSeconds: number): Promise<ServerMute> =>
        apiClient
            .put<{ data: ServerMute }>(`/api/v1/servers/${serverId}/mutes/${userId}`, {
                duration_seconds: durationSeconds,
            })
            .then(r => r.data.data),

    /**
     * Lifts a mute before it ends (SCRUM-71). Idempotent like the mute itself:
     * lifting one that is not there answers the same, 204.
     */
    unmuteMember: (serverId: string, userId: string): Promise<void> =>
        apiClient
            .delete(`/api/v1/servers/${serverId}/mutes/${userId}`)
            .then(() => undefined),

    /**
     * Lists the bans of a server, newest first (SCRUM-70).
     *
     * Needs BAN_MEMBERS: without it the backend answers 403, so callers only
     * ask when the user has the bit.
     */
    listBans: (serverId: string): Promise<ServerBan[]> =>
        apiClient
            .get<{ data: ServerBan[] }>(`/api/v1/servers/${serverId}/bans/`)
            .then(r => r.data.data),

    /**
     * Revokes a ban (SCRUM-70): the user can join again with a valid
     * invitation, but is not made a member. Idempotent like the ban itself, so
     * revoking one that is already gone answers the same.
     */
    revokeBan: (serverId: string, userId: string): Promise<void> =>
        apiClient
            .delete(`/api/v1/servers/${serverId}/bans/${userId}`)
            .then(() => undefined),
});
