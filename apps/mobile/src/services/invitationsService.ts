import { api } from '@/services/api';
import type { Invitation } from '@/types/invitation';
import type { Member } from '@/types/member';

export const createInvitation = (
    serverId: string,
    expiresInHours?: number,
    maxUses?: number,
): Promise<Invitation> => {
    const form = new FormData();
    if (expiresInHours !== undefined) form.append('expires_in_hours', String(expiresInHours));
    if (maxUses !== undefined) form.append('max_uses', String(maxUses));
    return api.post<Invitation>(`/servers/${serverId}/invitations/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
};

export const listInvitations = (serverId: string): Promise<Invitation[]> =>
    api.get<Invitation[]>(`/servers/${serverId}/invitations/`).then(r => r.data);

export const revokeInvitation = (serverId: string, code: string): Promise<void> =>
    api.delete(`/servers/${serverId}/invitations/${code}`).then(() => undefined);

export const joinServer = (code: string): Promise<Member> =>
    api.post<Member>(`/invites/${code}/accept`).then(r => r.data);
