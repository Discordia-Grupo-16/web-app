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
        setMicrophoneEnabled = vi.fn<(enabled: boolean) => Promise<unknown>>(async () => undefined);
        createTracks = vi.fn<(options: { audio: boolean }) => Promise<unknown[]>>(async () => [new FakeTrack()]);
        publishTrack = vi.fn<(track: unknown) => Promise<unknown>>(async () => undefined);
        getTrackPublication = vi.fn<(source: string) => unknown>(() => undefined);
    }
    // A local microphone track: records mute calls and lets each test emit its events.
    class FakeTrack {
        handlers = new Map<string, Handler[]>();
        isMuted = false;
        mediaStreamTrack = { readyState: 'live' as 'live' | 'ended' };
        mute = vi.fn(async () => {
            this.isMuted = true;
        });
        stop = vi.fn();
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
    class FakeRoom {
        static instances: FakeRoom[] = [];
        static connectError: unknown = null;
        static getLocalDevices = vi.fn<(kind: string) => Promise<unknown[]>>(async () => [{ deviceId: 'default' }]);
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
    return { FakeRoom, FakeParticipant, FakeTrack, ConnectionError };
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
    Track: { Kind: { Audio: 'audio', Video: 'video' }, Source: { Microphone: 'microphone', Camera: 'camera' } },
    TrackEvent: { Muted: 'muted', Ended: 'ended', Restarted: 'restarted' },
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

    it.each(['reconnecting', 'signalReconnecting'])('reports the reconnection on %s and its end', async (event) => {
        const { adapter, room } = await connected();
        const states: boolean[] = [];
        adapter.onReconnectingChanged((reconnecting) => states.push(reconnecting));

        room.emit(event);
        room.emit('reconnected');

        expect(states).toEqual([true, false]);
    });

    it('ignores the reconnection of a room that was already left', async () => {
        const { adapter, room } = await connected();
        const states: boolean[] = [];
        adapter.onReconnectingChanged((reconnecting) => states.push(reconnecting));
        await adapter.disconnect();

        room.emit('reconnecting');

        expect(states).toEqual([]);
    });

    it('stops the microphone that arrives after leaving the call', async () => {
        const { adapter, room } = await connected();
        const track = { stop: vi.fn() };
        let grant: () => void = () => undefined;
        room.localParticipant.setMicrophoneEnabled.mockImplementationOnce(
            () => new Promise((resolve) => (grant = () => resolve({ track } as never))),
        );

        const result = adapter.enableMicrophone();
        await adapter.disconnect();
        grant();

        expect(await result).toBe('no-device');
        expect(track.stop).toHaveBeenCalled();
    });

    it('disconnects the current room', async () => {
        const { adapter, room } = await connected();

        await adapter.disconnect();

        expect(room.disconnect).toHaveBeenCalled();
    });

    describe('microphone (SCRUM-53, Silenciar micrófono propio)', () => {
        type FakeTrack = InstanceType<typeof mocks.FakeTrack>;
        const flush = async () => {
            for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
        };
        const publishMic = (room: ReturnType<typeof lastRoom>, track: FakeTrack) =>
            room.emit('localTrackPublished', { source: 'microphone', track });
        const permission = (state: PermissionState) =>
            vi.stubGlobal('navigator', { ...navigator, permissions: { query: vi.fn(async () => ({ state })) } });
        const listen = (adapter: ReturnType<typeof createLivekitAdapter>) => {
            const causes: string[] = [];
            adapter.onMicrophoneLost((cause) => causes.push(cause));
            return causes;
        };

        beforeEach(() => {
            permission('granted');
            mocks.FakeRoom.getLocalDevices.mockResolvedValue([{ deviceId: 'default' }]);
        });

        it('publishes the new track already muted', async () => {
            const { adapter, room } = await connected();
            const track = new mocks.FakeTrack();
            const order: string[] = [];
            track.mute.mockImplementationOnce(async () => {
                order.push('mute');
                track.isMuted = true;
            });
            room.localParticipant.createTracks.mockResolvedValueOnce([track]);
            room.localParticipant.publishTrack.mockImplementationOnce(async () => {
                order.push('publish');
                return undefined;
            });

            expect(await adapter.enableMicrophone({ muted: true })).toBe('ok');

            expect(room.localParticipant.createTracks).toHaveBeenCalledWith({ audio: true });
            expect(order).toEqual(['mute', 'publish']);
            expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(track);
            expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
        });

        it('still turns the microphone on with LiveKit when not muted', async () => {
            const { adapter, room } = await connected();

            expect(await adapter.enableMicrophone()).toBe('ok');

            expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
            expect(room.localParticipant.createTracks).not.toHaveBeenCalled();
        });

        it('mutes the published microphone', async () => {
            const { adapter, room } = await connected();

            await adapter.muteMicrophone();

            expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
        });

        it('does nothing when muting without a room', async () => {
            const adapter = createLivekitAdapter();

            await expect(adapter.muteMicrophone()).resolves.toBeUndefined();
        });

        it.each([
            ['granted', 'no-device'],
            ['denied', 'blocked'],
        ] as const)('reports the microphone lost when LiveKit mutes an ended track (permission %s)', async (state, cause) => {
            permission(state);
            const { adapter, room } = await connected();
            const causes = listen(adapter);
            const track = new mocks.FakeTrack();
            publishMic(room, track);

            track.mediaStreamTrack.readyState = 'ended';
            track.emit('muted', track);
            await flush();

            expect(causes).toEqual([cause]);
        });

        it('does not report the mute asked by the user', async () => {
            const { adapter, room } = await connected();
            const causes = listen(adapter);
            const track = new mocks.FakeTrack();
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
            mocks.FakeRoom.getLocalDevices.mockResolvedValue([]);
            const { adapter, room } = await connected();
            const causes = listen(adapter);
            const track = new mocks.FakeTrack();
            track.isMuted = true;
            publishMic(room, track);

            track.emit('ended', track);
            await flush();

            expect(causes).toEqual(['no-device']);
        });

        it('does not report a muted track that ends while another microphone is left', async () => {
            const { adapter, room } = await connected();
            const causes = listen(adapter);
            const track = new mocks.FakeTrack();
            track.isMuted = true;
            publishMic(room, track);

            track.emit('ended', track);
            await flush();

            expect(causes).toEqual([]);
        });

        it('does not report a track that LiveKit restarts with another microphone', async () => {
            mocks.FakeRoom.getLocalDevices.mockResolvedValue([]);
            const { adapter, room } = await connected();
            const causes = listen(adapter);
            const track = new mocks.FakeTrack();
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
            const track = new mocks.FakeTrack();
            publishMic(room, track);
            await adapter.disconnect();

            track.mediaStreamTrack.readyState = 'ended';
            track.emit('muted', track);
            await flush();

            expect(causes).toEqual([]);
        });
    });
});
