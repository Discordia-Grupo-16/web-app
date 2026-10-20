// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoiceToken } from '@discordia/api';
import { useVoiceController } from './useVoiceController';
import type {
    MicLossCause,
    MicResult,
    RoomDisconnectInfo,
    VoiceChannelRef,
    VoiceControllerOptions,
    VoiceParticipant,
    VoiceRoomAdapter,
} from './types';

const A: VoiceChannelRef = { id: 'channel-a', serverId: 'server-1', name: 'General' };
const B: VoiceChannelRef = { id: 'channel-b', serverId: 'server-1', name: 'Juegos' };

const tokenFor = (channelId: string): VoiceToken => ({
    token: `token-${channelId}`,
    url: 'wss://voice.example.com',
    roomName: channelId,
    expiresAt: '2026-10-13T12:10:00Z',
});

const me: VoiceParticipant = { userId: 'me', isLocal: true, muted: false, joinedAt: 1000, seenOrder: 0 };
const ana: VoiceParticipant = { userId: 'ana', isLocal: false, muted: true, joinedAt: 500, seenOrder: 1 };

const httpError = (status?: number) =>
    Object.assign(new Error('Request failed'), { isAxiosError: true, response: status ? { status } : undefined });

// Fake adapter: records the calls and lets each test emit what the LiveKit room would.
const createFakeAdapter = () => {
    const disconnected = new Set<(info: RoomDisconnectInfo) => void>();
    const participants = new Set<(snapshot: VoiceParticipant[]) => void>();
    const playback = new Set<(blocked: boolean) => void>();
    const reconnecting = new Set<(value: boolean) => void>();
    const micLost = new Set<(cause: MicLossCause) => void>();
    const subscribe = <T>(set: Set<T>) => (listener: T) => {
        set.add(listener);
        return () => set.delete(listener);
    };
    let mic: MicResult = 'ok';
    const adapter = {
        connect: vi.fn(async (_url: string, _token: string) => undefined),
        disconnect: vi.fn(async () => undefined),
        enableMicrophone: vi.fn(async () => mic),
        onDisconnected: subscribe(disconnected),
        onParticipantsChanged: subscribe(participants),
        onReconnectingChanged: subscribe(reconnecting),
        muteMicrophone: vi.fn(async () => undefined),
        onMicrophoneLost: subscribe(micLost),
        onAudioPlaybackBlocked: subscribe(playback),
        startAudio: vi.fn(async () => undefined),
    } satisfies VoiceRoomAdapter;
    return {
        adapter,
        setMic: (result: MicResult) => {
            mic = result;
        },
        emitDisconnected: (info: RoomDisconnectInfo) => act(() => disconnected.forEach((l) => l(info))),
        emitParticipants: (snapshot: VoiceParticipant[]) => act(() => participants.forEach((l) => l(snapshot))),
        emitPlaybackBlocked: (blocked: boolean) => act(() => playback.forEach((l) => l(blocked))),
        emitReconnecting: (value: boolean) => act(() => reconnecting.forEach((l) => l(value))),
        emitMicrophoneLost: (cause: MicLossCause) => act(() => micLost.forEach((l) => l(cause))),
    };
};

describe('useVoiceController', () => {
    let fake: ReturnType<typeof createFakeAdapter>;
    let requestToken: ReturnType<typeof vi.fn<(channelId: string) => Promise<VoiceToken>>>;

    beforeEach(() => {
        fake = createFakeAdapter();
        requestToken = vi.fn(async (channelId: string) => tokenFor(channelId));
    });

    const render = (overrides: Partial<VoiceControllerOptions> = {}) =>
        renderHook((props: VoiceControllerOptions) => useVoiceController(props), {
            initialProps: { adapter: fake.adapter, requestToken, ...overrides },
        });

    const joinAndWait = async (result: ReturnType<typeof render>['result'], channel: VoiceChannelRef) => {
        act(() => result.current.value.join(channel));
        await waitFor(() => {
            const { call } = result.current.value;
            expect(call.status === 'connected' && call.channel.id === channel.id).toBe(true);
        });
    };

    it('joins: connecting first and connected with the snapshot after (CA1 de SCRUM-51, Unirse a canal de voz de servidor)', async () => {
        const { result } = render();

        act(() => result.current.value.join(A));
        expect(result.current.value.attempt).toEqual({ status: 'connecting', channel: A });

        fake.emitParticipants([ana, me]);
        await waitFor(() => expect(result.current.value.call.status).toBe('connected'));
        expect(fake.adapter.connect).toHaveBeenCalledWith('wss://voice.example.com', 'token-channel-a');
        expect(result.current.value.attempt).toBeNull();
        expect(result.current.value.call).toEqual({
            status: 'connected',
            channel: A,
            micAvailable: true,
            micBlocked: false,
            muted: false,
            micPending: false,
            reconnecting: false,
            participants: [ana, me],
        });

        fake.emitParticipants([me]);
        expect(result.current.value.call).toMatchObject({ participants: [me] });
    });

    it('does nothing when joining the channel of the current call', async () => {
        const { result } = render();
        await joinAndWait(result, A);

        act(() => result.current.value.join(A));

        expect(result.current.value.attempt).toBeNull();
        expect(requestToken).toHaveBeenCalledTimes(1);
        expect(fake.adapter.connect).toHaveBeenCalledTimes(1);
    });

    it.each([
        [403, 'forbidden'],
        [404, 'not-found'],
        [422, 'not-voice'],
    ] as const)(
        'keeps the call in A when joining B is rejected with %i (CA2 de SCRUM-51, Unirse a canal de voz de servidor)',
        async (status, error) => {
            const { result } = render();
            await joinAndWait(result, A);
            requestToken.mockRejectedValueOnce(httpError(status));

            act(() => result.current.value.join(B));

            await waitFor(() => expect(result.current.value.attempt).toEqual({ status: 'failed', channel: B, error }));
            expect(result.current.value.call).toMatchObject({ status: 'connected', channel: A });
            expect(fake.adapter.disconnect).not.toHaveBeenCalled();
        },
    );

    it('switches from A to B asking the token before leaving A and hiding the exit (CA3 de SCRUM-51, Unirse a canal de voz de servidor)', async () => {
        const { result } = render();
        await joinAndWait(result, A);
        const order: string[] = [];
        requestToken.mockImplementationOnce(async (channelId) => {
            order.push('token');
            // chat removes the user from A when it signs the token for B.
            fake.emitDisconnected({ cause: 'participant_removed', serverReason: 'other_device' });
            return tokenFor(channelId);
        });
        fake.adapter.disconnect.mockImplementationOnce(async () => {
            order.push('disconnect');
            fake.emitDisconnected({ cause: 'client_initiated', serverReason: null });
        });

        act(() => result.current.value.join(B));
        expect(result.current.value.call).toMatchObject({ status: 'connected', channel: A });

        await waitFor(() => expect(result.current.value.call).toMatchObject({ status: 'connected', channel: B }));
        expect(order).toEqual(['token', 'disconnect']);
        expect(fake.adapter.connect).toHaveBeenLastCalledWith('wss://voice.example.com', 'token-channel-b');
        expect(result.current.value.attempt).toBeNull();
    });

    it('ends without a call when connecting to B fails after the token', async () => {
        const { result } = render();
        await joinAndWait(result, A);
        fake.adapter.connect.mockRejectedValueOnce({ kind: 'unavailable' });

        act(() => result.current.value.join(B));

        await waitFor(() =>
            expect(result.current.value.attempt).toEqual({ status: 'failed', channel: B, error: 'unavailable' }),
        );
        expect(result.current.value.call).toEqual({ status: 'idle' });
    });

    it.each([
        ['503', 'unavailable', httpError(503)],
        ['500', 'unavailable', httpError(500)],
        ['502', 'unavailable', httpError(502)],
        ['429', 'unavailable', httpError(429)],
        ['no response', 'network', httpError()],
    ] as const)('maps %s to %s and allows retrying', async (_label, expected, error) => {
        const { result } = render();
        requestToken.mockRejectedValueOnce(error);

        act(() => result.current.value.join(A));
        await waitFor(() => expect(result.current.value.attempt).toMatchObject({ status: 'failed', error: expected }));

        act(() => result.current.value.retry());
        await waitFor(() => expect(result.current.value.call).toMatchObject({ status: 'connected', channel: A }));
        expect(requestToken).toHaveBeenCalledTimes(2);
    });

    it('maps a rejected LiveKit connection to its kind', async () => {
        const { result } = render();
        fake.adapter.connect.mockRejectedValueOnce({ kind: 'network' });

        act(() => result.current.value.join(A));

        await waitFor(() => expect(result.current.value.attempt).toMatchObject({ status: 'failed', error: 'network' }));
    });

    it('does not retry a failure that cannot be fixed by retrying', async () => {
        const { result } = render();
        requestToken.mockRejectedValueOnce(httpError(403));
        act(() => result.current.value.join(A));
        await waitFor(() => expect(result.current.value.attempt).toMatchObject({ error: 'forbidden' }));

        act(() => result.current.value.retry());

        expect(requestToken).toHaveBeenCalledTimes(1);
        expect(result.current.value.attempt).toMatchObject({ error: 'forbidden' });
    });

    it('dismisses a failed attempt', async () => {
        const { result } = render();
        requestToken.mockRejectedValueOnce(httpError(404));
        act(() => result.current.value.join(A));
        await waitFor(() => expect(result.current.value.attempt).toMatchObject({ error: 'not-found' }));

        act(() => result.current.value.dismiss());

        expect(result.current.value.attempt).toBeNull();
    });

    it.each([
        ['denied', false],
        ['blocked', true],
        ['no-device', false],
    ] as const)('stays connected without microphone when it is %s', async (mic, micBlocked) => {
        fake.setMic(mic);
        const { result } = render();

        await joinAndWait(result, A);

        await waitFor(() => expect(result.current.value.call).toMatchObject({ micAvailable: false, muted: true, micBlocked }));
        expect(result.current.value.attempt).toBeNull();
    });

    it('moves the call to B as soon as it connects, while the microphone is still being asked', async () => {
        const { result } = render();
        await joinAndWait(result, A);
        let answer: (mic: MicResult) => void = () => undefined;
        fake.adapter.enableMicrophone.mockImplementationOnce(() => new Promise<MicResult>((resolve) => (answer = resolve)));

        act(() => result.current.value.join(B));

        await waitFor(() => expect(result.current.value.call).toMatchObject({ status: 'connected', channel: B, muted: true }));
        expect(result.current.value.attempt).toBeNull();
        await act(async () => answer('ok'));
        expect(result.current.value.call).toMatchObject({ status: 'connected', channel: B, micAvailable: true, muted: false });
    });

    it('keeps the disconnection when the room drops while the microphone is being asked', async () => {
        const { result } = render();
        let answer: (mic: MicResult) => void = () => undefined;
        fake.adapter.enableMicrophone.mockImplementationOnce(() => new Promise<MicResult>((resolve) => (answer = resolve)));
        await joinAndWait(result, A);

        fake.emitDisconnected({ cause: 'participant_removed', serverReason: 'kicked' });
        await act(async () => answer('ok'));

        expect(result.current.value.call).toEqual({ status: 'disconnected', channel: A, reason: 'kicked' });
    });

    it.each([
        { cause: 'participant_removed', serverReason: 'kicked', reason: 'kicked' },
        { cause: 'participant_removed', serverReason: 'permissions_revoked', reason: 'permissions_revoked' },
        { cause: 'duplicate_identity', serverReason: null, reason: 'other_device' },
        { cause: 'room_deleted', serverReason: null, reason: 'channel_deleted' },
        { cause: 'connection_lost', serverReason: null, reason: 'connection_lost' },
    ] as const)('shows the disconnection $cause with $serverReason as $reason and never reconnects', async ({ cause, serverReason, reason }) => {
        const { result } = render();
        await joinAndWait(result, A);

        fake.emitDisconnected({ cause, serverReason });

        expect(result.current.value.call).toEqual({ status: 'disconnected', channel: A, reason });
        expect(fake.adapter.connect).toHaveBeenCalledTimes(1);
        expect(requestToken).toHaveBeenCalledTimes(1);

        act(() => result.current.value.dismiss());
        expect(result.current.value.call).toEqual({ status: 'idle' });
    });

    it('disconnects with a client reason', async () => {
        const { result } = render();
        await joinAndWait(result, A);

        act(() => result.current.disconnectWithReason('app_backgrounded'));

        expect(fake.adapter.disconnect).toHaveBeenCalledTimes(1);
        expect(result.current.value.call).toEqual({ status: 'disconnected', channel: A, reason: 'app_backgrounded' });
        fake.emitDisconnected({ cause: 'client_initiated', serverReason: null });
        expect(result.current.value.call).toMatchObject({ reason: 'app_backgrounded' });
    });

    it('ignores a client reason without a call', () => {
        const { result } = render();

        act(() => result.current.disconnectWithReason('app_backgrounded'));

        expect(fake.adapter.disconnect).not.toHaveBeenCalled();
        expect(result.current.value.call).toEqual({ status: 'idle' });
    });

    it('reports the blocked playback and starts the audio', () => {
        const { result } = render();

        fake.emitPlaybackBlocked(true);
        expect(result.current.value.audioBlocked).toBe(true);

        act(() => result.current.value.startAudio());
        expect(fake.adapter.startAudio).toHaveBeenCalled();
    });

    it('is not available without an adapter', () => {
        const { result } = render({ adapter: null });

        expect(result.current.value.available).toBe(false);
        act(() => result.current.value.join(A));
        expect(requestToken).not.toHaveBeenCalled();
    });

    describe('leaving (SCRUM-52, Salir de canal de voz)', () => {
        const deferred = <T,>() => {
            let resolve: (value: T) => void = () => undefined;
            const promise = new Promise<T>((r) => (resolve = r));
            return { promise, resolve };
        };

        it('leaves a connected call without showing an error (CA1 de SCRUM-52, Salir de canal de voz)', async () => {
            const { result } = render();
            await joinAndWait(result, A);

            act(() => result.current.value.leave());

            expect(result.current.value.call.status).toBe('idle');
            expect(fake.adapter.disconnect).toHaveBeenCalledTimes(1);
            fake.emitDisconnected({ cause: 'client_initiated', serverReason: null });
            expect(result.current.value.call).toEqual({ status: 'idle' });
        });

        it('stays out when the microphone answer arrives after leaving', async () => {
            const { result } = render();
            const mic = deferred<MicResult>();
            fake.adapter.enableMicrophone.mockImplementationOnce(() => mic.promise);
            await joinAndWait(result, A);

            act(() => result.current.value.leave());
            await act(async () => mic.resolve('ok'));

            expect(result.current.value.call).toEqual({ status: 'idle' });
        });

        it.each([
            ['alone', false],
            ['while switching from A to B', true],
        ])('does nothing with a join in progress, %s', async (_label, switching) => {
            const { result } = render();
            if (switching) await joinAndWait(result, A);
            const callBefore = result.current.value.call;
            const token = deferred<VoiceToken>();
            requestToken.mockImplementationOnce(() => token.promise);
            act(() => result.current.value.join(B));

            act(() => result.current.value.leave());

            expect(result.current.value.call).toBe(callBefore);
            expect(result.current.value.attempt).toEqual({ status: 'connecting', channel: B });
            expect(fake.adapter.disconnect).not.toHaveBeenCalled();
        });

        it('never calls the backend to leave', async () => {
            const { result } = render();
            await joinAndWait(result, A);

            act(() => result.current.value.leave());

            expect(requestToken).toHaveBeenCalledTimes(1);
        });

        it('joins again like the first time after leaving (CA2 de SCRUM-52, Salir de canal de voz)', async () => {
            const { result } = render();
            await joinAndWait(result, A);
            fake.emitParticipants([ana, me]);
            act(() => result.current.value.leave());

            await joinAndWait(result, A);

            expect(result.current.value.call).toMatchObject({ status: 'connected', channel: A, participants: [] });
            fake.emitParticipants([me]);
            expect(result.current.value.call).toMatchObject({ participants: [me] });
        });

        it('rejoins from a lost connection', async () => {
            const { result } = render();
            await joinAndWait(result, A);
            fake.emitDisconnected({ cause: 'connection_lost', serverReason: null });
            expect(result.current.value.call).toMatchObject({ status: 'disconnected', reason: 'connection_lost' });

            await joinAndWait(result, A);

            expect(fake.adapter.connect).toHaveBeenCalledTimes(2);
        });

        it('shows the reconnection without touching the microphone state', async () => {
            fake.setMic('denied');
            const { result } = render();
            await joinAndWait(result, A);
            await waitFor(() => expect(result.current.value.call).toMatchObject({ micAvailable: false }));

            fake.emitReconnecting(true);
            expect(result.current.value.call).toMatchObject({
                reconnecting: true,
                micAvailable: false,
                micBlocked: false,
                muted: true,
            });

            fake.emitReconnecting(false);
            expect(result.current.value.call).toMatchObject({ reconnecting: false, micAvailable: false, muted: true });
        });

        it('leaves while reconnecting', async () => {
            const { result } = render();
            await joinAndWait(result, A);
            fake.emitReconnecting(true);

            act(() => result.current.value.leave());

            expect(result.current.value.call).toEqual({ status: 'idle' });
            expect(fake.adapter.disconnect).toHaveBeenCalledTimes(1);
        });

        it('ends with a lost connection when the reconnection fails', async () => {
            const { result } = render();
            await joinAndWait(result, A);
            fake.emitReconnecting(true);

            fake.emitDisconnected({ cause: 'connection_lost', serverReason: null });

            expect(result.current.value.call).toEqual({ status: 'disconnected', channel: A, reason: 'connection_lost' });
        });

        it('stops a join waiting for the token when unmounted', async () => {
            const { result, unmount } = render();
            const token = deferred<VoiceToken>();
            requestToken.mockImplementationOnce(() => token.promise);
            act(() => result.current.value.join(A));

            unmount();
            await act(async () => token.resolve(tokenFor(A.id)));

            expect(fake.adapter.connect).not.toHaveBeenCalled();
        });

        it('closes the room of a join that connects after being unmounted', async () => {
            const { result, unmount } = render();
            const connected = deferred<undefined>();
            fake.adapter.connect.mockImplementationOnce(() => connected.promise);
            act(() => result.current.value.join(A));
            await waitFor(() => expect(fake.adapter.connect).toHaveBeenCalled());

            unmount();
            await act(async () => connected.resolve(undefined));

            expect(fake.adapter.disconnect).toHaveBeenCalledTimes(1);
            expect(fake.adapter.enableMicrophone).not.toHaveBeenCalled();
        });

        it('closes the room when unmounted while the microphone is being asked', async () => {
            const { result, unmount } = render();
            const mic = deferred<MicResult>();
            fake.adapter.enableMicrophone.mockImplementationOnce(() => mic.promise);
            await joinAndWait(result, A);

            unmount();
            await act(async () => mic.resolve('ok'));

            expect(fake.adapter.disconnect).toHaveBeenCalledTimes(1);
        });

        it('cuts a join in progress when the app goes to the background', async () => {
            const { result } = render();
            const token = deferred<VoiceToken>();
            requestToken.mockImplementationOnce(() => token.promise);
            act(() => result.current.value.join(A));

            act(() => result.current.disconnectWithReason('app_backgrounded'));
            await act(async () => token.resolve(tokenFor(A.id)));

            expect(result.current.value.call).toEqual({ status: 'disconnected', channel: A, reason: 'app_backgrounded' });
            expect(result.current.value.attempt).toBeNull();
            expect(fake.adapter.connect).not.toHaveBeenCalled();
        });

        it('cuts the call in A and stops the switch to B when the app goes to the background', async () => {
            const { result } = render();
            await joinAndWait(result, A);
            const token = deferred<VoiceToken>();
            requestToken.mockImplementationOnce(() => token.promise);
            act(() => result.current.value.join(B));

            act(() => result.current.disconnectWithReason('app_backgrounded'));
            await act(async () => token.resolve(tokenFor(B.id)));

            expect(result.current.value.call).toEqual({ status: 'disconnected', channel: A, reason: 'app_backgrounded' });
            expect(result.current.value.attempt).toBeNull();
            expect(fake.adapter.connect).toHaveBeenCalledTimes(1);
        });
    });
});
