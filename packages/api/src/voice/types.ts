export interface VoiceToken {
    token: string;
    url: string; // LiveKit wss:// URL
    roomName: string; // equal to the channelId
    expiresAt: string; // ISO-8601 in UTC with Z
}

export interface VoiceTokenResponse {
    data: VoiceToken;
}

/**
 * Someone connected to a voice channel, as `chat` knows it (chat.yaml `VoiceParticipant`). Named
 * apart from core's `VoiceParticipant`, which is the live call's participant with mute and order.
 * No mute: it is a state of the call, seen from inside it.
 */
export interface VoiceRosterParticipant {
    userId: string;
    joinedAt: string; // ISO-8601 in UTC
}

/** One voice channel's roster. `syncedAt` is the watermark: apply a roster only if it is newer. */
export interface VoiceRoomParticipants {
    channelId: string;
    participants: VoiceRosterParticipant[];
    syncedAt: string; // ISO-8601 in UTC; the fraction digits vary, compare it as a date
}

export interface ServerVoiceParticipantsResponse {
    data: VoiceRoomParticipants[];
}
