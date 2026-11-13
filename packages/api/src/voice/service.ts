import type { AxiosInstance } from 'axios';
import type { ServerVoiceParticipantsResponse, VoiceRoomParticipants, VoiceToken, VoiceTokenResponse } from './types';

export const createVoiceService = (apiClient: AxiosInstance) => ({
    createVoiceToken: (channelId: string): Promise<VoiceToken> =>
        apiClient.post<VoiceTokenResponse>(`/api/v1/channels/${channelId}/voice-tokens`).then(r => r.data.data),

    // Only the rooms with people in them: a channel that is not in the list is empty.
    getServerVoiceParticipants: (serverId: string): Promise<VoiceRoomParticipants[]> =>
        apiClient
            .get<ServerVoiceParticipantsResponse>(`/api/v1/servers/${serverId}/voice-participants`)
            .then(r => r.data.data),
});
