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

/**
 * Whether the user can publish audio in a voice channel, as `chat` re-evaluated it (SCRUM-71).
 * `remainingSeconds` is calculated by the server, so the client sets its timer without its clock.
 */
export interface VoicePublishState {
    canPublish: boolean;
    mutedUntil: string | null; // ISO-8601 in UTC with Z
    remainingSeconds: number; // 0 when canPublish is true
}

export interface VoicePublishStateResponse {
    data: VoicePublishState;
}

export interface ServerVoiceParticipantsResponse {
    data: VoiceRoomParticipants[];
}
