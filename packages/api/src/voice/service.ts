import type { AxiosInstance } from 'axios';
import type { VoiceToken, VoiceTokenResponse } from './types';

export const createVoiceService = (apiClient: AxiosInstance) => ({
    createVoiceToken: (channelId: string): Promise<VoiceToken> =>
        apiClient.post<VoiceTokenResponse>(`/api/v1/channels/${channelId}/voice-tokens`).then(r => r.data.data),
});
