export interface VoiceToken {
    token: string;
    url: string; // LiveKit wss:// URL
    roomName: string; // equal to the channelId
    expiresAt: string; // ISO-8601 in UTC with Z
}

export interface VoiceTokenResponse {
    data: VoiceToken;
}
