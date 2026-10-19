import { PermissionsAndroid } from 'react-native';
import type { RoomDisconnectInfo, VoiceParticipant } from '@discordia/core';
import { createLivekitAdapter, requestMicrophonePermission } from './livekitAdapter';

type Handler = (...args: unknown[]) => void;

// A small stand-in for livekit-client: a Room that records the calls and lets each test emit events.
class MockParticipant {
  attributes: Record<string, string> = {};
  isMicrophoneEnabled = true;
  constructor(
    public identity: string,
    public joinedAt?: Date,
  ) {}
  setMicrophoneEnabled = jest.fn(async () => undefined);
}

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
  Room: jest.fn(() => new MockRoom()),
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
    jest.clearAllMocks();
    MockRoom.instances = [];
    MockRoom.connectError = null;
    requestPermission.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  });

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
    expect(mockAudioSession.stopAudioSession).toHaveBeenCalledTimes(2);
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
    expect(mockAudioSession.stopAudioSession).toHaveBeenCalled();
  });

  it('disconnects the room and stops the audio session', async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://lk', 'jwt');

    await adapter.disconnect();

    expect(lastRoom().disconnect).toHaveBeenCalled();
    expect(mockAudioSession.stopAudioSession).toHaveBeenCalled();
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
