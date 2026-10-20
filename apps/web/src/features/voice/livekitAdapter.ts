import {
    ConnectionError,
    ConnectionErrorReason,
    DisconnectReason,
    Room,
    RoomEvent,
    Track,
    type RemoteTrack,
} from 'livekit-client';
import {
    buildParticipantSnapshot,
    readServerReason,
    type EnableMicrophoneOptions,
    type MicLossCause,
    type MicResult,
    type RoomConnectFailure,
    type RoomDisconnectCause,
    type RoomDisconnectInfo,
    type VoiceParticipant,
    type VoiceRoomAdapter,
} from '@discordia/core';

// Events after which the list of the call can change: who is in the room and who has an active microphone.
const SNAPSHOT_EVENTS = [
    RoomEvent.Connected,
    RoomEvent.Reconnected,
    RoomEvent.ParticipantConnected,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.TrackPublished,
    RoomEvent.TrackUnpublished,
    RoomEvent.TrackMuted,
    RoomEvent.TrackUnmuted,
    RoomEvent.LocalTrackPublished,
    RoomEvent.LocalTrackUnpublished,
] as const;

const disconnectCause = (reason: DisconnectReason | undefined): RoomDisconnectCause => {
    switch (reason) {
        case DisconnectReason.CLIENT_INITIATED:
            return 'client_initiated';
        case DisconnectReason.PARTICIPANT_REMOVED:
            return 'participant_removed';
        case DisconnectReason.DUPLICATE_IDENTITY:
            return 'duplicate_identity';
        case DisconnectReason.ROOM_DELETED:
        case DisconnectReason.ROOM_CLOSED:
            return 'room_deleted';
        case DisconnectReason.SIGNAL_CLOSE:
        case DisconnectReason.JOIN_FAILURE:
        case DisconnectReason.STATE_MISMATCH:
            return 'connection_lost';
        default:
            return 'other';
    }
};

const connectFailure = (error: unknown): RoomConnectFailure => {
    if (!navigator.onLine) return 'network';
    if (error instanceof ConnectionError && error.reason === ConnectionErrorReason.Timeout) return 'network';
    return 'unavailable';
};

const microphonePermissionDenied = async (): Promise<boolean> => {
    try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return status.state === 'denied';
    } catch {
        return false;
    }
};

// VoiceRoomAdapter over a livekit-client Room. A new Room per connection, so nothing from the
// previous call (participants, tracks, listeners) leaks into the next one.
export const createLivekitAdapter = (): VoiceRoomAdapter => {
    const disconnectedListeners = new Set<(info: RoomDisconnectInfo) => void>();
    const participantListeners = new Set<(snapshot: VoiceParticipant[]) => void>();
    const playbackListeners = new Set<(blocked: boolean) => void>();
    const reconnectingListeners = new Set<(reconnecting: boolean) => void>();
    // Provisional: registered, never notified yet.
    const micLostListeners = new Set<(cause: MicLossCause) => void>();
    let room: Room | null = null;

    const subscribe =
        <T>(listeners: Set<T>) =>
        (listener: T) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        };

    const emitPlayback = (current: Room) => playbackListeners.forEach((l) => l(!current.canPlaybackAudio));

    const attachAudio = (track: RemoteTrack) => {
        if (track.kind !== Track.Kind.Audio) return;
        const element = track.attach();
        element.hidden = true;
        document.body.appendChild(element);
    };
    const detachAudio = (track: RemoteTrack) => track.detach().forEach((element) => element.remove());

    const createRoom = (): Room => {
        // disconnectOnPageLeave stays on its default (true): closing the tab sends the leave.
        const next = new Room();
        const seen = new Map<string, number>();
        const emitSnapshot = () => {
            const snapshot = buildParticipantSnapshot(next, seen);
            participantListeners.forEach((l) => l(snapshot));
        };
        SNAPSHOT_EVENTS.forEach((event) => next.on(event, emitSnapshot));
        next.on(RoomEvent.TrackSubscribed, attachAudio);
        next.on(RoomEvent.TrackUnsubscribed, detachAudio);
        next.on(RoomEvent.AudioPlaybackStatusChanged, () => emitPlayback(next));
        // Only the current room counts: a room already left keeps no listener in the call.
        const emitReconnecting = (reconnecting: boolean) => {
            if (room === next) reconnectingListeners.forEach((l) => l(reconnecting));
        };
        next.on(RoomEvent.SignalReconnecting, () => emitReconnecting(true));
        next.on(RoomEvent.Reconnecting, () => emitReconnecting(true));
        next.on(RoomEvent.Reconnected, () => emitReconnecting(false));
        next.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
            if (room === next) room = null;
            const info: RoomDisconnectInfo = {
                cause: disconnectCause(reason),
                serverReason: readServerReason(next.localParticipant.attributes),
            };
            participantListeners.forEach((l) => l([]));
            disconnectedListeners.forEach((l) => l(info));
        });
        return next;
    };

    return {
        async connect(url, token) {
            const next = createRoom();
            room = next;
            try {
                await next.connect(url, token, { autoSubscribe: true });
            } catch (error) {
                if (room === next) room = null;
                throw { kind: connectFailure(error) };
            }
            // Autoplay policies: try now, and if the browser blocks it the UI offers a click to enable it.
            await next.startAudio().catch(() => undefined);
            emitPlayback(next);
        },

        async disconnect() {
            const current = room;
            room = null;
            await current?.disconnect();
        },

        // Provisional: the options are not used yet.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async enableMicrophone(_options?: EnableMicrophoneOptions): Promise<MicResult> {
            const current = room;
            if (!current) return 'no-device';
            try {
                const publication = await current.localParticipant.setMicrophoneEnabled(true);
                // The call was left while the browser was asking: the microphone must not stay on.
                if (room !== current) {
                    publication?.track?.stop();
                    return 'no-device';
                }
                return 'ok';
            } catch (error) {
                if (room !== current) return 'no-device';
                const name = (error as { name?: string } | null)?.name;
                if (name === 'NotAllowedError') return (await microphonePermissionDenied()) ? 'blocked' : 'denied';
                return 'no-device';
            }
        },

        onDisconnected: subscribe(disconnectedListeners),
        onParticipantsChanged: subscribe(participantListeners),
        onReconnectingChanged: subscribe(reconnectingListeners),
        onMicrophoneLost: subscribe(micLostListeners),

        // Provisional: it does not mute yet.
        async muteMicrophone() {},
        onAudioPlaybackBlocked: subscribe(playbackListeners),

        async startAudio() {
            if (!room) return;
            await room.startAudio();
            emitPlayback(room);
        },
    };
};
