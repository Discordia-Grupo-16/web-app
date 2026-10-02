import type { AxiosInstance } from 'axios';
import type { Invitation, Member } from './types';

export const createInvitationsService = (apiClient: AxiosInstance) => ({
    createInvitation: (serverId: string, expiresInHours?: number, maxUses?: number): Promise<Invitation> => {
        const form = new FormData();
        if (expiresInHours !== undefined) form.append('expires_in_hours', String(expiresInHours));
        if (maxUses !== undefined) form.append('max_uses', String(maxUses));
        return apiClient.post<Invitation>(`/api/v1/servers/${serverId}/invitations/`, form).then(r => r.data);
    },

    listInvitations: (serverId: string): Promise<Invitation[]> =>
        apiClient.get<Invitation[]>(`/api/v1/servers/${serverId}/invitations/`).then(r => r.data),

    revokeInvitation: (serverId: string, code: string): Promise<void> =>
        apiClient.delete(`/api/v1/servers/${serverId}/invitations/${code}`).then(() => undefined),

    joinServer: (code: string): Promise<Member> =>
        apiClient.post<Member>(`/api/v1/invites/${code}/accept`).then(r => r.data),
});
