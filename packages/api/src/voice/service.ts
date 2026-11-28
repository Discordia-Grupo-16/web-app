import type { AxiosInstance } from 'axios';
import type {
    ServerVoiceParticipantsResponse,
    VoicePublishState,
    VoicePublishStateResponse,
    VoiceRoomParticipants,
    VoiceToken,
    VoiceTokenResponse,
} from './types';

export const createVoiceService = (apiClient: AxiosInstance) => ({
    createVoiceToken: (channelId: string): Promise<VoiceToken> =>
        apiClient.post<VoiceTokenResponse>(`/api/v1/channels/${channelId}/voice-tokens`).then(r => r.data.data),

    // chat checks its own projection and applies the result in LiveKit: the client only asks again.
    // Calling it more than needed changes nothing (SCRUM-71).
    refreshVoicePermissions: (channelId: string): Promise<VoicePublishState> =>
        apiClient
            .put<VoicePublishStateResponse>(`/api/v1/channels/${channelId}/voice-permissions`)
            .then(r => r.data.data),

    // Only the rooms with people in them: a channel that is not in the list is empty.
    getServerVoiceParticipants: (serverId: string): Promise<VoiceRoomParticipants[]> =>
        apiClient
            .get<ServerVoiceParticipantsResponse>(`/api/v1/servers/${serverId}/voice-participants`)
            .then(r => r.data.data),
});
