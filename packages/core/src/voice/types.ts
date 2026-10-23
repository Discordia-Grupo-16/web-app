import type { VoiceToken } from '@discordia/api';

export type VoiceJoinError = 'forbidden' | 'not-found' | 'not-voice' | 'unavailable' | 'network';

// Values of the "disconnectReason" attribute that chat writes on the LiveKit participant.
export type VoiceServerReason =
    | 'other_device'
    | 'left_server'
    | 'kicked'
    | 'banned'
    | 'suspended'
    | 'permissions_revoked'
    | 'channel_deleted';
export type VoiceClientReason = 'connection_lost' | 'app_backgrounded';
export type VoiceDisconnectReason = VoiceServerReason | VoiceClientReason;
export type MicResult = 'ok' | 'denied' | 'blocked' | 'no-device';

export interface VoiceChannelRef {
    id: string;
    serverId: string;
    name: string;
}

export interface VoiceParticipant {
    userId: string; // LiveKit identity
    isLocal: boolean;
    muted: boolean; // no published and enabled microphone
    joinedAt: number; // ms epoch, with second resolution
    seenOrder: number; // tie-break: the order in which this client saw it
}

export type VoiceCall =
    | { status: 'idle' }
    | {
          status: 'connected';
          channel: VoiceChannelRef;
          micAvailable: boolean;
          micBlocked: boolean;
          muted: boolean;
          participants: VoiceParticipant[];
      }
    | { status: 'disconnected'; channel: VoiceChannelRef; reason: VoiceDisconnectReason };

export type VoiceJoinAttempt =
    | { status: 'connecting'; channel: VoiceChannelRef }
    | { status: 'failed'; channel: VoiceChannelRef; error: VoiceJoinError };

// LiveKit's cause already translated by the adapter (its DisconnectReason enum stays out of core).
export type RoomDisconnectCause =
    | 'client_initiated'
    | 'participant_removed'
    | 'duplicate_identity'
    | 'room_deleted'
    | 'connection_lost'
    | 'other';
export interface RoomDisconnectInfo {
    cause: RoomDisconnectCause;
    serverReason: VoiceServerReason | null;
}
export type RoomConnectFailure = 'unavailable' | 'network';

export interface VoiceRoomAdapter {
    connect(url: string, token: string): Promise<void>; // rejects with { kind: RoomConnectFailure }
    disconnect(): Promise<void>;
    enableMicrophone(): Promise<MicResult>;
    onDisconnected(listener: (info: RoomDisconnectInfo) => void): () => void;
    onParticipantsChanged(listener: (snapshot: VoiceParticipant[]) => void): () => void;
    onAudioPlaybackBlocked?: (listener: (blocked: boolean) => void) => () => void; // web only
    startAudio?: () => Promise<void>; // web only
}

// Minimal structural types for the pure helpers. livekit-client's Room and Participant satisfy them.
export interface RoomLike {
    localParticipant: ParticipantLike;
    remoteParticipants: ReadonlyMap<string, ParticipantLike>;
}
export interface ParticipantLike {
    identity: string;
    joinedAt?: Date;
    isMicrophoneEnabled: boolean;
    attributes: Readonly<Record<string, string>>;
}

export interface VoiceControllerOptions {
    adapter: VoiceRoomAdapter | null; // null: voice is not available (Expo Go)
    requestToken: (channelId: string) => Promise<VoiceToken>;
}

export interface VoiceContextValue {
    call: VoiceCall;
    attempt: VoiceJoinAttempt | null;
    available: boolean; // false when the adapter is null
    audioBlocked: boolean; // web: the browser blocked playback
    join: (channel: VoiceChannelRef) => void;
    retry: () => void; // retries a retryable failed attempt
    dismiss: () => void; // clears a failed attempt or a disconnected call
    startAudio: () => void;
}

export interface VoiceController {
    value: VoiceContextValue;
    disconnectWithReason: (reason: VoiceClientReason) => void;
}
