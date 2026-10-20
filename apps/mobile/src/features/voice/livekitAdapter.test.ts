import { PermissionsAndroid } from 'react-native';
import type { RoomDisconnectInfo, VoiceParticipant } from '@discordia/core';
import {
  AUDIO_RESTART_GAP_MS,
  AUDIO_STOP_DELAY_MS,
  createLivekitAdapter,
  requestMicrophonePermission,
} from './livekitAdapter';

type Handler = (...args: unknown[]) => void;

// A small stand-in for livekit-client: a Room that records the calls and lets each test emit events.
class MockParticipant {
  attributes: Record<string, string> = {};
  isMicrophoneEnabled = true;
  constructor(
    public identity: string,
    public joinedAt?: Date,
  ) {}
  setMicrophoneEnabled = jest.fn<Promise<unknown>, [boolean]>(async () => undefined);
  createTracks = jest.fn<Promise<unknown[]>, [{ audio: boolean }]>(async () => [new MockTrack()]);
  publishTrack = jest.fn<Promise<unknown>, [unknown]>(async () => undefined);
  getTrackPublication = jest.fn<unknown, [string]>(() => undefined);
}

// A local microphone track: records mute calls and lets each test emit its events.
class MockTrack {
  handlers = new Map<string, Handler[]>();
  isMuted = false;
  mediaStreamTrack = { readyState: 'live' as 'live' | 'ended' };
  mute = jest.fn(async () => {
    this.isMuted = true;
  });
  stop = jest.fn();
  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  off(event: string, handler: Handler) {
    this.handlers.set(event, (this.handlers.get(event) ?? []).filter((h) => h !== handler));
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((h) => h(...args));
  }
}

const mockGetLocalDevices = jest.fn<Promise<unknown[]>, [string, boolean?]>(async () => [{ deviceId: 'default' }]);

class MockRoom {
  static instances: MockRoom[] = [];
  static connectError: unknown = null;
  handlers = new Map<string, Handler[]>();
  localParticipant = new MockParticipant('me', new Date(2000));
  remoteParticipants = new Map<string, MockParticipant>();
  connect = jest.fn(async () => {
    if (MockRoom.connectError) throw MockRoom.connectError;
  });
  disconnect = jest.fn(async () => undefined);
  constructor() {
    MockRoom.instances.push(this);
  }
  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  emit(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((h) => h(...args));
  }
}

class MockConnectionError extends Error {
  constructor(public reason: number) {
    super('connection error');
  }
}

jest.mock('livekit-client', () => ({
  Room: Object.assign(
    jest.fn(() => new MockRoom()),
    { getLocalDevices: (kind: string, requestPermissions?: boolean) => mockGetLocalDevices(kind, requestPermissions) },
  ),
  Track: { Source: { Microphone: 'microphone', Camera: 'camera' } },
  TrackEvent: { Muted: 'muted', Ended: 'ended', Restarted: 'restarted' },
  get ConnectionError() {
    return MockConnectionError;
  },
  ConnectionErrorReason: { NotAllowed: 0, ServerUnreachable: 1, Timeout: 5 },
  DisconnectReason: {
    UNKNOWN_REASON: 0,
    CLIENT_INITIATED: 1,
    DUPLICATE_IDENTITY: 2,
    PARTICIPANT_REMOVED: 4,
    ROOM_DELETED: 5,
    STATE_MISMATCH: 6,
    JOIN_FAILURE: 7,
    SIGNAL_CLOSE: 9,
    ROOM_CLOSED: 10,
  },
  RoomEvent: {
    Connected: 'connected',
    Reconnected: 'reconnected',
    Reconnecting: 'reconnecting',
    SignalReconnecting: 'signalReconnecting',
    Disconnected: 'disconnected',
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackPublished: 'trackPublished',
    TrackUnpublished: 'trackUnpublished',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    LocalTrackPublished: 'localTrackPublished',
    LocalTrackUnpublished: 'localTrackUnpublished',
  },
}));

jest.mock('@livekit/react-native', () => ({
  AudioSession: {
    configureAudio: jest.fn(async () => undefined),
    startAudioSession: jest.fn(async () => undefined),
    stopAudioSession: jest.fn(async () => undefined),
  },
  AndroidAudioTypePresets: { communication: { audioMode: 'inCommunication' } },
}));

const mockAudioSession = jest.requireMock<{
  AudioSession: Record<'configureAudio' | 'startAudioSession' | 'stopAudioSession', jest.Mock>;
}>('@livekit/react-native').AudioSession;

const lastRoom = () => MockRoom.instances[MockRoom.instances.length - 1];
const requestPermission = jest.spyOn(PermissionsAndroid, 'request');

describe('createLivekitAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
    jest.clearAllMocks();
    MockRoom.instances = [];
    MockRoom.connectError = null;
    requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  });

  afterEach(() => jest.useRealTimers());

  it('configures the audio session for communication before connecting', async () => {
    const adapter = createLivekitAdapter();

    await adapter.connect('wss://lk', 'jwt');

    expect(mockAudioSession.configureAudio).toHaveBeenCalledWith({
      android: { audioTypeOptions: { audioMode: 'inCommunication' } },
    });
    expect(mockAudioSession.startAudioSession).toHaveBeenCalled();
    expect(lastRoom().connect).toHaveBeenCalledWith('wss://lk', 'jwt', { autoSubscribe: true });
  });

  it('rejects with network on a connection timeout and unavailable otherwise', async () => {
    const adapter = createLivekitAdapter();

    MockRoom.connectError = new MockConnectionError(5);
    await expect(adapter.connect('wss://lk', 'jwt')).rejects.toEqual({ kind: 'network' });

    MockRoom.connectError = new MockConnectionError(1);
    await expect(adapter.connect('wss://lk', 'jwt')).rejects.toEqual({ kind: 'unavailable' });
    jest.advanceTimersByTime(AUDIO_STOP_DELAY_MS);
    expect(mockAudioSession.stopAudioSession).toHaveBeenCalledTimes(1);
  });

  it('sends the participant snapshot when the room changes', async () => {
    const adapter = createLivekitAdapter();
    const snapshots: VoiceParticipant[][] = [];
    adapter.onParticipantsChanged((s) => snapshots.push(s));
    await adapter.connect('wss://lk', 'jwt');

    lastRoom().emit('connected');

    expect(snapshots[0]).toEqual([expect.objectContaining({ userId: 'me', isLocal: true, muted: false })]);
  });

  it('translates the disconnection and reads the reason from the server', async () => {
    const adapter = createLivekitAdapter();
    const infos: RoomDisconnectInfo[] = [];
    const snapshots: VoiceParticipant[][] = [];
    adapter.onDisconnected((i) => infos.push(i));
    adapter.onParticipantsChanged((s) => snapshots.push(s));
    await adapter.connect('wss://lk', 'jwt');
    lastRoom().localParticipant.attributes = { disconnectReason: 'kicked' };

    lastRoom().emit('disconnected', 4);

    expect(infos).toEqual([{ cause: 'participant_removed', serverReason: 'kicked' }]);
    expect(snapshots).toEqual([[]]);
    jest.advanceTimersByTime(AUDIO_STOP_DELAY_MS);
    expect(mockAudioSession.stopAudioSession).toHaveBeenCalled();
  });

  it('disconnects the room and stops the audio session', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'jwt');

    await adapter.disconnect();

    expect(lastRoom().disconnect).toHaveBeenCalled();
    expect(mockAudioSession.stopAudioSession).not.toHaveBeenCalled();
    jest.advanceTimersByTime(AUDIO_STOP_DELAY_MS);
    expect(mockAudioSession.stopAudioSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the audio session open when switching rooms', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'room-a');

    await adapter.disconnect();
    await adapter.connect('wss://lk', 'room-b');
    jest.advanceTimersByTime(AUDIO_STOP_DELAY_MS);

    expect(mockAudioSession.stopAudioSession).not.toHaveBeenCalled();
    expect(mockAudioSession.startAudioSession).toHaveBeenCalledTimes(1);
    expect(lastRoom().connect).toHaveBeenCalledWith('wss://lk', 'room-b', { autoSubscribe: true });
  });

  it('waits a moment after stopping the audio session before starting it again', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'room-a');
    await adapter.disconnect();
    jest.advanceTimersByTime(AUDIO_STOP_DELAY_MS);

    const connecting = adapter.connect('wss://lk', 'room-b');
    await Promise.resolve();
    expect(mockAudioSession.startAudioSession).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(AUDIO_RESTART_GAP_MS);
    await connecting;

    expect(mockAudioSession.startAudioSession).toHaveBeenCalledTimes(2);
  });

  it.each(['reconnecting', 'signalReconnecting'])('reports the reconnection on %s and its end', async (event) => {
    const adapter = createLivekitAdapter();
    const states: boolean[] = [];
    adapter.onReconnectingChanged((reconnecting) => states.push(reconnecting));
    await adapter.connect('wss://lk', 'jwt');

    lastRoom().emit(event);
    lastRoom().emit('reconnected');

    expect(states).toEqual([true, false]);
  });

  it('ignores the reconnection of a room that was already left', async () => {
    const adapter = createLivekitAdapter();
    const states: boolean[] = [];
    adapter.onReconnectingChanged((reconnecting) => states.push(reconnecting));
    await adapter.connect('wss://lk', 'jwt');
    const left = lastRoom();
    await adapter.disconnect();

    left.emit('reconnecting');

    expect(states).toEqual([]);
  });

  it('stops the microphone that arrives after leaving the call', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'jwt');
    const track = { stop: jest.fn() };
    let grant: () => void = () => undefined;
    lastRoom().localParticipant.setMicrophoneEnabled.mockImplementationOnce(
      () => new Promise((resolve) => (grant = () => resolve({ track } as never))),
    );

    const result = adapter.enableMicrophone();
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
    await adapter.disconnect();
    grant();

    await expect(result).resolves.toBe('no-device');
    expect(track.stop).toHaveBeenCalled();
  });

  it('does not turn the microphone on when the call was left during the permission dialog', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'jwt');
    let answer: () => void = () => undefined;
    requestPermission.mockImplementationOnce(
      () => new Promise((resolve) => (answer = () => resolve(PermissionsAndroid.RESULTS.GRANTED))),
    );
    const room = lastRoom();

    const result = adapter.enableMicrophone();
    await adapter.disconnect();
    answer();

    await expect(result).resolves.toBe('no-device');
    expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  });

  it('turns the microphone on once the permission is granted', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'jwt');

    await expect(adapter.enableMicrophone()).resolves.toBe('ok');
    expect(lastRoom().localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  });

  it('does not touch the microphone when the permission is not granted', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'jwt');
    requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    await expect(adapter.enableMicrophone()).resolves.toBe('denied');
    expect(lastRoom().localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  });

  it('reports no-device when the microphone cannot start', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'jwt');
    lastRoom().localParticipant.setMicrophoneEnabled.mockRejectedValue(new Error('no input'));

    await expect(adapter.enableMicrophone()).resolves.toBe('no-device');
  });

  describe('microphone (SCRUM-53, Silenciar micrófono propio)', () => {
    const flush = async () => {
      for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(() => resolve()));
    };
    const connected = async () => {
      const adapter = createLivekitAdapter();
      await adapter.connect('wss://lk', 'jwt');
      return { adapter, room: lastRoom() };
    };
    const publishMic = (room: MockRoom, track: MockTrack) =>
      room.emit('localTrackPublished', { source: 'microphone', track });
    const listen = (adapter: ReturnType<typeof createLivekitAdapter>) => {
      const causes: string[] = [];
      adapter.onMicrophoneLost((cause) => causes.push(cause));
      return causes;
    };

    beforeEach(() => mockGetLocalDevices.mockResolvedValue([{ deviceId: 'default' }]));

    it('asks for the permission and publishes the new track already muted', async () => {
      const { adapter, room } = await connected();
      const track = new MockTrack();
      const order: string[] = [];
      requestPermission.mockImplementationOnce(async () => {
        order.push('permission');
        return PermissionsAndroid.RESULTS.GRANTED;
      });
      track.mute.mockImplementationOnce(async () => {
        order.push('mute');
        track.isMuted = true;
      });
      room.localParticipant.createTracks.mockResolvedValueOnce([track]);
      room.localParticipant.publishTrack.mockImplementationOnce(async () => {
        order.push('publish');
        return undefined;
      });

      await expect(adapter.enableMicrophone({ muted: true })).resolves.toBe('ok');

      expect(room.localParticipant.createTracks).toHaveBeenCalledWith({ audio: true });
      expect(order).toEqual(['permission', 'mute', 'publish']);
      expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    });

    it.each([
      [PermissionsAndroid.RESULTS.DENIED, 'denied'],
      [PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN, 'blocked'],
    ])('does not create the muted track without the permission (%s)', async (answer, expected) => {
      const { adapter, room } = await connected();
      requestPermission.mockResolvedValueOnce(answer);

      await expect(adapter.enableMicrophone({ muted: true })).resolves.toBe(expected);
      expect(room.localParticipant.createTracks).not.toHaveBeenCalled();
    });

    it('mutes the published microphone', async () => {
      const { adapter, room } = await connected();

      await adapter.muteMicrophone();

      expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    });

    it('does nothing when muting without a room', async () => {
      await expect(createLivekitAdapter().muteMicrophone()).resolves.toBeUndefined();
    });

    it('reports the microphone lost when LiveKit mutes an ended track', async () => {
      const { adapter, room } = await connected();
      const causes = listen(adapter);
      const track = new MockTrack();
      publishMic(room, track);

      track.mediaStreamTrack.readyState = 'ended';
      track.emit('muted', track);
      await flush();

      expect(causes).toEqual(['no-device']);
    });

    it('does not report the mute asked by the user', async () => {
      const { adapter, room } = await connected();
      const causes = listen(adapter);
      const track = new MockTrack();
      publishMic(room, track);
      room.localParticipant.setMicrophoneEnabled.mockImplementationOnce(async () => {
        track.emit('muted', track);
        return undefined;
      });

      await adapter.muteMicrophone();
      await flush();

      expect(causes).toEqual([]);
    });

    it('reports the microphone lost when a muted track ends and no microphone is left', async () => {
      mockGetLocalDevices.mockResolvedValue([]);
      const { adapter, room } = await connected();
      const causes = listen(adapter);
      const track = new MockTrack();
      track.isMuted = true;
      publishMic(room, track);

      track.emit('ended', track);
      await flush();

      expect(causes).toEqual(['no-device']);
    });

    it('does not report a muted track that ends while another microphone is left', async () => {
      const { adapter, room } = await connected();
      const causes = listen(adapter);
      const track = new MockTrack();
      track.isMuted = true;
      publishMic(room, track);

      track.emit('ended', track);
      await flush();

      expect(causes).toEqual([]);
    });

    it('does not report a track that LiveKit restarts with another microphone', async () => {
      mockGetLocalDevices.mockResolvedValue([]);
      const { adapter, room } = await connected();
      const causes = listen(adapter);
      const track = new MockTrack();
      track.isMuted = true;
      publishMic(room, track);

      track.emit('ended', track);
      track.emit('restarted', track);
      await flush();

      expect(causes).toEqual([]);
    });

    it('ignores the microphone of a room that was already left', async () => {
      const { adapter, room } = await connected();
      const causes = listen(adapter);
      const track = new MockTrack();
      publishMic(room, track);
      await adapter.disconnect();

      track.mediaStreamTrack.readyState = 'ended';
      track.emit('muted', track);
      await flush();

      expect(causes).toEqual([]);
    });
  });
});

describe('requestMicrophonePermission', () => {
  it.each([
    [PermissionsAndroid.RESULTS.GRANTED, 'ok'],
    [PermissionsAndroid.RESULTS.DENIED, 'denied'],
    [PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN, 'blocked'],
  ])('maps %s to %s', async (result, expected) => {
    requestPermission.mockResolvedValue(result);

    await expect(requestMicrophonePermission()).resolves.toBe(expected);
    expect(requestPermission).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  });
});
