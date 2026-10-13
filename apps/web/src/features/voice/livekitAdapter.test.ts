import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomDisconnectInfo, VoiceParticipant } from '@discordia/core';
import { createLivekitAdapter } from './livekitAdapter';

// A small stand-in for livekit-client: a Room that records the calls and lets each test emit events.
const mocks = vi.hoisted(() => {
    type Handler = (...args: unknown[]) => void;
    class FakeParticipant {
        attributes: Record<string, string> = {};
        isMicrophoneEnabled = true;
        identity: string;
        joinedAt?: Date;
        constructor(identity: string, joinedAt?: Date) {
            this.identity = identity;
            this.joinedAt = joinedAt;
        }
        setMicrophoneEnabled = vi.fn(async () => undefined);
    }
    class FakeRoom {
        static instances: FakeRoom[] = [];
        static connectError: unknown = null;
        handlers = new Map<string, Handler[]>();
        localParticipant = new FakeParticipant('me', new Date(2000));
        remoteParticipants = new Map<string, FakeParticipant>();
        canPlaybackAudio = true;
        connect = vi.fn(async () => {
            if (FakeRoom.connectError) throw FakeRoom.connectError;
        });
        disconnect = vi.fn(async () => undefined);
        startAudio = vi.fn(async () => undefined);
        constructor() {
            FakeRoom.instances.push(this);
        }
        on(event: string, handler: Handler) {
            this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
            return this;
        }
        emit(event: string, ...args: unknown[]) {
            this.handlers.get(event)?.forEach((h) => h(...args));
        }
    }
    class ConnectionError extends Error {
        reason: number;
        constructor(reason: number) {
            super('connection error');
            this.reason = reason;
        }
    }
    return { FakeRoom, FakeParticipant, ConnectionError };
});

vi.mock('livekit-client', () => ({
    Room: mocks.FakeRoom,
    ConnectionError: mocks.ConnectionError,
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
    Track: { Kind: { Audio: 'audio', Video: 'video' } },
    RoomEvent: {
        Connected: 'connected',
        Reconnected: 'reconnected',
        Disconnected: 'disconnected',
        ParticipantConnected: 'participantConnected',
        ParticipantDisconnected: 'participantDisconnected',
        TrackPublished: 'trackPublished',
        TrackUnpublished: 'trackUnpublished',
        TrackSubscribed: 'trackSubscribed',
        TrackUnsubscribed: 'trackUnsubscribed',
        TrackMuted: 'trackMuted',
        TrackUnmuted: 'trackUnmuted',
        LocalTrackPublished: 'localTrackPublished',
        LocalTrackUnpublished: 'localTrackUnpublished',
        AudioPlaybackStatusChanged: 'audioPlaybackChanged',
    },
}));

const lastRoom = () => mocks.FakeRoom.instances[mocks.FakeRoom.instances.length - 1];

const connected = async () => {
    const adapter = createLivekitAdapter();
    await adapter.connect('wss://voice.example.com', 'jwt');
    return { adapter, room: lastRoom() };
};

describe('createLivekitAdapter', () => {
    beforeEach(() => {
        mocks.FakeRoom.instances = [];
        mocks.FakeRoom.connectError = null;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('connects with automatic subscription and tries to start the audio', async () => {
        const { room } = await connected();

        expect(room.connect).toHaveBeenCalledWith('wss://voice.example.com', 'jwt', { autoSubscribe: true });
        expect(room.startAudio).toHaveBeenCalled();
    });

    it('sends the snapshot of the call when someone joins', async () => {
        const { adapter, room } = await connected();
        const snapshots: VoiceParticipant[][] = [];
        adapter.onParticipantsChanged((s) => snapshots.push(s));
        const ana = new mocks.FakeParticipant('ana', new Date(1000));
        ana.isMicrophoneEnabled = false;
        room.remoteParticipants.set('ana', ana);

        room.emit('participantConnected', ana);

        expect(snapshots.at(-1)?.map((p) => [p.userId, p.isLocal, p.muted])).toEqual([
            ['ana', false, true],
            ['me', true, false],
        ]);
    });

    it.each([
        [1, 'client_initiated'],
        [2, 'duplicate_identity'],
        [4, 'participant_removed'],
        [5, 'room_deleted'],
        [9, 'connection_lost'],
        [0, 'other'],
    ] as const)('translates the disconnection reason %i to %s', async (reason, cause) => {
        const { adapter, room } = await connected();
        const infos: RoomDisconnectInfo[] = [];
        adapter.onDisconnected((i) => infos.push(i));

        room.emit('disconnected', reason);

        expect(infos).toEqual([{ cause, serverReason: null }]);
    });

    it('reads the reason written by chat on the local participant', async () => {
        const { adapter, room } = await connected();
        const infos: RoomDisconnectInfo[] = [];
        adapter.onDisconnected((i) => infos.push(i));
        room.localParticipant.attributes = { disconnectReason: 'kicked' };

        room.emit('disconnected', 4);

        expect(infos).toEqual([{ cause: 'participant_removed', serverReason: 'kicked' }]);
    });

    it('attaches remote audio to an audio element and removes it when unsubscribed', async () => {
        const { room } = await connected();
        const element = document.createElement('audio');
        const track = { kind: 'audio', attach: vi.fn(() => element), detach: vi.fn(() => [element]) };

        room.emit('trackSubscribed', track);
        expect(document.body.contains(element)).toBe(true);

        room.emit('trackUnsubscribed', track);
        expect(document.body.contains(element)).toBe(false);
    });

    it('reports the blocked playback and starts it on request', async () => {
        const { adapter, room } = await connected();
        const blocked: boolean[] = [];
        adapter.onAudioPlaybackBlocked?.((b) => blocked.push(b));

        room.canPlaybackAudio = false;
        room.emit('audioPlaybackChanged');
        room.canPlaybackAudio = true;
        await adapter.startAudio?.();

        expect(blocked).toEqual([true, false]);
        expect(room.startAudio).toHaveBeenCalledTimes(2);
    });

    it.each([
        ['NotAllowedError', 'prompt', 'denied'],
        ['NotAllowedError', 'denied', 'blocked'],
        ['NotFoundError', 'prompt', 'no-device'],
    ] as const)('translates %s with the permission in %s to %s', async (name, state, result) => {
        vi.stubGlobal('navigator', { ...navigator, permissions: { query: vi.fn(async () => ({ state })) } });
        const { adapter, room } = await connected();
        room.localParticipant.setMicrophoneEnabled.mockRejectedValueOnce(Object.assign(new Error('mic'), { name }));

        expect(await adapter.enableMicrophone()).toBe(result);
    });

    it('enables the microphone', async () => {
        const { adapter, room } = await connected();

        expect(await adapter.enableMicrophone()).toBe('ok');
        expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    });

    it.each([
        ['a rejection from LiveKit', new mocks.ConnectionError(0), true, 'unavailable'],
        ['a timeout', new mocks.ConnectionError(5), true, 'network'],
        ['no network', new Error('offline'), false, 'network'],
    ] as const)('rejects %s with its kind', async (_label, error, onLine, kind) => {
        vi.stubGlobal('navigator', { ...navigator, onLine });
        mocks.FakeRoom.connectError = error;
        const adapter = createLivekitAdapter();

        await expect(adapter.connect('wss://voice.example.com', 'jwt')).rejects.toEqual({ kind });
    });

    it('disconnects the current room', async () => {
        const { adapter, room } = await connected();

        await adapter.disconnect();

        expect(room.disconnect).toHaveBeenCalled();
    });
});
