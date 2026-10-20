import { PermissionsAndroid } from 'react-native';
import { AndroidAudioTypePresets, AudioSession } from '@livekit/react-native';
import { ConnectionError, ConnectionErrorReason, DisconnectReason, Room, RoomEvent } from 'livekit-client';
import {
  buildParticipantSnapshot,
  readServerReason,
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

const connectFailure = (error: unknown): RoomConnectFailure =>
  error instanceof ConnectionError && error.reason === ConnectionErrorReason.Timeout ? 'network' : 'unavailable';

// never_ask_again means Android will not show the dialog again: only the app settings can grant it.
export const requestMicrophonePermission = async (): Promise<Exclude<MicResult, 'no-device'>> => {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'ok';
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
};

// On Android, @livekit/react-native's stopAudioSession tears the session down later, on its own thread,
// and a startAudioSession that comes right after still sees the old session and does nothing. The new
// call then stays without it: low volume on both sides and the earpiece instead of the speaker. So the
// session is kept open across a room switch, and after a real stop the next start waits a moment.
export const AUDIO_STOP_DELAY_MS = 1500;
export const AUDIO_RESTART_GAP_MS = 500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// VoiceRoomAdapter over a livekit-client Room. A new Room per connection, so nothing from the
// previous call (participants, tracks, listeners) leaks into the next one. Remote audio is played by
// the native WebRTC module, so there is nothing to attach.
export const createLivekitAdapter = (): VoiceRoomAdapter => {
  const disconnectedListeners = new Set<(info: RoomDisconnectInfo) => void>();
  const participantListeners = new Set<(snapshot: VoiceParticipant[]) => void>();
  const reconnectingListeners = new Set<(reconnecting: boolean) => void>();
  let room: Room | null = null;
  let audioStarted = false;
  let pendingAudioStop: ReturnType<typeof setTimeout> | null = null;
  let lastAudioStopAt = 0;

  const startAudio = async () => {
    if (pendingAudioStop) {
      clearTimeout(pendingAudioStop);
      pendingAudioStop = null;
    }
    if (audioStarted) return;
    const wait = lastAudioStopAt + AUDIO_RESTART_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    // The audio session has to be configured before connecting for it to apply.
    await AudioSession.configureAudio({ android: { audioTypeOptions: AndroidAudioTypePresets.communication } });
    await AudioSession.startAudioSession();
    audioStarted = true;
  };

  // A connect that comes before the delay (a room switch) cancels it and keeps the session.
  const stopAudioSoon = () => {
    if (!audioStarted || pendingAudioStop) return;
    pendingAudioStop = setTimeout(() => {
      pendingAudioStop = null;
      audioStarted = false;
      lastAudioStopAt = Date.now();
      void AudioSession.stopAudioSession();
    }, AUDIO_STOP_DELAY_MS);
  };

  const subscribe =
    <T>(listeners: Set<T>) =>
    (listener: T) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    };

  const createRoom = (): Room => {
    const next = new Room();
    const seen = new Map<string, number>();
    const emitSnapshot = () => {
      const snapshot = buildParticipantSnapshot(next, seen);
      participantListeners.forEach((l) => l(snapshot));
    };
    SNAPSHOT_EVENTS.forEach((event) => next.on(event, emitSnapshot));
    // Only the current room counts: a room already left keeps no listener in the call.
    const emitReconnecting = (reconnecting: boolean) => {
      if (room === next) reconnectingListeners.forEach((l) => l(reconnecting));
    };
    next.on(RoomEvent.SignalReconnecting, () => emitReconnecting(true));
    next.on(RoomEvent.Reconnecting, () => emitReconnecting(true));
    next.on(RoomEvent.Reconnected, () => emitReconnecting(false));
    next.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
      if (room === next) {
        room = null;
        stopAudioSoon();
      }
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
        await startAudio();
        await next.connect(url, token, { autoSubscribe: true });
      } catch (error) {
        if (room === next) {
          room = null;
          stopAudioSoon();
        }
        throw { kind: connectFailure(error) };
      }
    },

    async disconnect() {
      const current = room;
      room = null;
      await current?.disconnect();
      if (current) stopAudioSoon();
    },

    async enableMicrophone(): Promise<MicResult> {
      const current = room;
      if (!current) return 'no-device';
      const permission = await requestMicrophonePermission();
      // The call may have been left while Android was asking.
      if (room !== current) return 'no-device';
      if (permission !== 'ok') return permission;
      try {
        const publication = await current.localParticipant.setMicrophoneEnabled(true);
        if (room !== current) {
          publication?.track?.stop();
          return 'no-device';
        }
        return 'ok';
      } catch {
        return 'no-device';
      }
    },

    onDisconnected: subscribe(disconnectedListeners),
    onParticipantsChanged: subscribe(participantListeners),
    onReconnectingChanged: subscribe(reconnectingListeners),
  };
};
