import type { AxiosInstance } from 'axios';
import type { ManualPresence, MemberPresence } from './types';

export const createPresenceService = (apiClient: AxiosInstance) => ({
    // Only the members who are not offline: a member who is not in the list is offline.
    getServerPresence: (serverId: string): Promise<MemberPresence[]> =>
        apiClient.get<{ data: MemberPresence[] }>(`/api/v1/servers/${serverId}/presence`).then(r => r.data.data),

    setManual: (manual: ManualPresence): Promise<void> =>
        apiClient.put('/api/v1/users/me/presence', { manual }).then(() => undefined),
});

export type PresenceService = ReturnType<typeof createPresenceService>;
