import { api } from './api.web';
import type { Invitation } from '../types/invitation';
import type { Member } from '../types/member';

export const createInvitation = (
    serverId: string,
    expiresInHours?: number,
    maxUses?: number,
): Promise<Invitation> => {
    const form = new FormData();
    if (expiresInHours !== undefined) form.append('expires_in_hours', String(expiresInHours));
    if (maxUses !== undefined) form.append('max_uses', String(maxUses));
    return api.post<Invitation>(`/api/v1/servers/${serverId}/invitations/`, form).then(r => r.data);
};

export const listInvitations = (serverId: string): Promise<Invitation[]> =>
    api.get<Invitation[]>(`/api/v1/servers/${serverId}/invitations/`).then(r => r.data);

export const revokeInvitation = (serverId: string, code: string): Promise<void> =>
    api.delete(`/api/v1/servers/${serverId}/invitations/${code}`).then(() => undefined);

export const joinServer = (code: string): Promise<Member> =>
    api.post<Member>(`/api/v1/invites/${code}/accept`).then(r => r.data);
