// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionState, RealtimeClient, RealtimeEventMap } from '@discordia/api';
import { useRealtimeController, type RealtimeControllerOptions } from './useRealtimeController';

// Fake client: records the calls and lets each test emit events as the socket would.
const createFakeClient = () => {
    // Stored untyped: each event has its own handler signature, emit restores it.
    type Handler = (arg: never) => void;
    const handlers = new Map<keyof RealtimeEventMap, Handler[]>();
    let state: ConnectionState = 'idle';
    const client = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        sendMessage: vi.fn(),
        getState: () => state,
        on<K extends keyof RealtimeEventMap>(event: K, handler: RealtimeEventMap[K]) {
            handlers.set(event, [...(handlers.get(event) ?? []), handler]);
            return () => {
                handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== handler));
            };
        },
    } satisfies RealtimeClient;
    const emit = <K extends keyof RealtimeEventMap>(event: K, arg: Parameters<RealtimeEventMap[K]>[0]) => {
        if (event === 'stateChange') state = arg as ConnectionState;
        act(() => handlers.get(event)?.forEach((h) => (h as (a: typeof arg) => void)(arg)));
    };
    return { client, emit };
};

const CHANNEL = 'channel-1';

describe('useRealtimeController', () => {
    let fake: ReturnType<typeof createFakeClient>;
    let ids: number;

    beforeEach(() => {
        fake = createFakeClient();
        ids = 0;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const render = (overrides: Partial<RealtimeControllerOptions> = {}) =>
        renderHook((props: RealtimeControllerOptions) => useRealtimeController(props), {
            initialProps: {
                client: fake.client,
                token: 'token',
                newClientMessageId: () => `msg-${++ids}`,
                api: { get: vi.fn().mockResolvedValue({ data: { data: [], hasMore: false } }) },
                messagesService: { editMessage: vi.fn(), deleteMessage: vi.fn() },
                logger: { error: vi.fn() },
                ...overrides,
            },
        });

    it('reports disabled and does nothing when there is no client', () => {
        const { result } = render({ client: null });
        expect(result.current.value.status).toBe('disabled');
        act(() => result.current.value.send(CHANNEL, 'hola'));
        expect(result.current.value.state.pending['msg-1']?.status).toBe('failed');
    });

    it('connects while there is a token and disconnects when it goes away', () => {
        const { rerender } = render();
        expect(fake.client.connect).toHaveBeenCalledTimes(1);

        rerender({ client: fake.client, token: null, newClientMessageId: () => 'x', api: { get: vi.fn() }, messagesService: { editMessage: vi.fn(), deleteMessage: vi.fn() }, logger: { error: vi.fn() } });
        expect(fake.client.disconnect).toHaveBeenCalled();
    });

    it('sends with a generated clientMessageId and clears the pending on ack', () => {
        const { result } = render();
        fake.emit('stateChange', 'open');

        act(() => result.current.value.send(CHANNEL, 'hola'));
        expect(fake.client.sendMessage).toHaveBeenCalledWith({ channelId: CHANNEL, content: 'hola', clientMessageId: 'msg-1' });
        expect(result.current.value.state.pending['msg-1']?.status).toBe('sending');

        fake.emit('ack', { type: 'message.ack', clientMessageId: 'msg-1', messageId: 'm1', createdAt: '2026-10-01T00:00:00Z' });
        expect(result.current.value.state.pending['msg-1']?.status).toBe('acked');
    });

    it('fails the message when the server does not answer in time', () => {
        vi.useFakeTimers();
        const { result } = render();

        act(() => result.current.value.send(CHANNEL, 'hola'));
        act(() => vi.advanceTimersByTime(10_000));

        expect(result.current.value.state.pending['msg-1']).toMatchObject({ status: 'failed', errorCode: 'TIMEOUT' });
    });

    it('fails the message right away when the socket refuses to send', () => {
        fake.client.sendMessage.mockImplementation(() => {
            throw new Error('not open');
        });
        const { result } = render();

        act(() => result.current.value.send(CHANNEL, 'hola'));

        expect(result.current.value.state.pending['msg-1']?.status).toBe('failed');
    });

    it('retries a failed message with the same clientMessageId', () => {
        fake.client.sendMessage.mockImplementationOnce(() => {
            throw new Error('not open');
        });
        const { result } = render();
        act(() => result.current.value.send(CHANNEL, 'hola'));

        act(() => result.current.value.retry('msg-1'));

        expect(fake.client.sendMessage).toHaveBeenLastCalledWith({ channelId: CHANNEL, content: 'hola', clientMessageId: 'msg-1' });
        expect(result.current.value.state.pending['msg-1']?.status).toBe('sending');
    });

    it('hands a too long message back to the composer and adopts the server limit', () => {
        const { result } = render();
        act(() => result.current.value.send(CHANNEL, 'x'.repeat(600)));

        fake.emit('errorFrame', {
            type: 'error',
            error: { code: 'MESSAGE_TOO_LONG', message: 'too long', correlationId: 'c1', details: { maxLength: 500 } },
        });

        expect(result.current.value.maxLength).toBe(500);
        expect(result.current.value.lastRejected).toEqual({
            channelId: CHANNEL,
            content: 'x'.repeat(600),
            code: 'MESSAGE_TOO_LONG',
            message: 'El mensaje supera el límite de 500 caracteres.',
        });
        expect(result.current.value.state.pending['msg-1']).toBeUndefined();

        act(() => result.current.value.clearRejected());
        expect(result.current.value.lastRejected).toBeNull();
    });

    it('marks a server error on the oldest message waiting for an answer', () => {
        const { result } = render();
        act(() => result.current.value.send(CHANNEL, 'hola'));

        fake.emit('errorFrame', {
            type: 'error',
            error: { code: 'FORBIDDEN', message: 'forbidden', correlationId: 'c1' },
        });

        expect(result.current.value.state.pending['msg-1']).toMatchObject({ status: 'failed', errorCode: 'FORBIDDEN' });
    });

    it('reads as connecting, not closed, while suspended until the socket comes back', () => {
        const { result } = render();
        fake.emit('stateChange', 'open');

        act(() => result.current.suspend());
        expect(fake.client.disconnect).toHaveBeenCalled();

        fake.emit('stateChange', 'closed');
        expect(result.current.value.status).toBe('connecting');

        fake.emit('stateChange', 'open');
        expect(result.current.value.status).toBe('open');
    });

    it('reports closed when the socket closes without suspend', () => {
        const { result } = render();
        fake.emit('stateChange', 'open');
        fake.emit('stateChange', 'closed');
        expect(result.current.value.status).toBe('closed');
    });

    it('resyncs on every open, not only after reconnecting (covers mobile suspend/resume)', async () => {
        const msg = { messageId: 'm1', clientMessageId: 'c1', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'x', createdAt: '2026-01-01T00:00:00Z' };
        const apiGet = vi.fn()
            .mockResolvedValueOnce({ data: { data: [msg], hasMore: false } })
            .mockResolvedValue({ data: { data: [], hasMore: false } });
        const { result } = render({ api: { get: apiGet } });

        // Initial open: load history
        fake.emit('stateChange', 'open');
        await act(async () => {
            result.current.value.loadHistory(CHANNEL);
            await Promise.resolve();
        });
        apiGet.mockClear();

        // Simulate mobile resume: closed → open without going through reconnecting
        fake.emit('stateChange', 'closed');
        fake.emit('stateChange', 'open');
        await act(async () => { await Promise.resolve(); });

        expect(apiGet).toHaveBeenCalled();
    });

    it('paginates resync when the server returns hasMore=true', async () => {
        const msg1 = { messageId: 'm1', clientMessageId: 'c1', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'a', createdAt: '2026-01-01T00:00:00Z' };
        const msg2 = { messageId: 'm2', clientMessageId: 'c2', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'b', createdAt: '2026-01-01T00:00:01Z' };
        const msg3 = { messageId: 'm3', clientMessageId: 'c3', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'c', createdAt: '2026-01-01T00:00:02Z' };
        const apiGet = vi.fn()
            .mockResolvedValueOnce({ data: { data: [msg1], hasMore: false } })
            .mockResolvedValueOnce({ data: { data: [msg2], hasMore: true } })
            .mockResolvedValueOnce({ data: { data: [msg3], hasMore: false } });
        const { result } = render({ api: { get: apiGet } });

        fake.emit('stateChange', 'open');
        await act(async () => {
            result.current.value.loadHistory(CHANNEL);
            await Promise.resolve();
        });

        fake.emit('stateChange', 'closed');
        fake.emit('stateChange', 'open');
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.value.state.byChannel[CHANNEL]?.map((m) => m.messageId)).toContain('m3');
    });

    it('dispatches historyFailed when loadHistory throws and retryHistory re-fetches', async () => {
        const apiGet = vi.fn()
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce({ data: { data: [], hasMore: false } });
        const { result } = render({ api: { get: apiGet } });

        fake.emit('stateChange', 'open');
        await act(async () => {
            result.current.value.loadHistory(CHANNEL);
            await Promise.resolve();
        });

        expect(result.current.value.state.historyByChannel[CHANNEL]?.error).toBe(true);
        expect(result.current.value.state.historyByChannel[CHANNEL]?.loaded).toBe(false);

        await act(async () => {
            result.current.value.retryHistory(CHANNEL);
            await Promise.resolve();
        });

        expect(result.current.value.state.historyByChannel[CHANNEL]?.error).toBe(false);
        expect(result.current.value.state.historyByChannel[CHANNEL]?.loaded).toBe(true);
    });

    it('loadMoreHistory fetches older messages and prepends them', async () => {
        const initialMsg = { messageId: 'm-init', clientMessageId: 'c-init', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'initial', createdAt: '2026-01-01T00:00:01Z' };
        const oldMsg = { messageId: 'm-old', clientMessageId: 'c-old', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'old', createdAt: '2026-01-01T00:00:00Z' };
        const apiGet = vi.fn()
            .mockResolvedValueOnce({ data: { data: [initialMsg], hasMore: true } })
            .mockResolvedValueOnce({ data: { data: [oldMsg], hasMore: false } });
        const { result } = render({ api: { get: apiGet } });

        fake.emit('stateChange', 'open');
        await act(async () => {
            result.current.value.loadHistory(CHANNEL);
            await Promise.resolve();
        });

        expect(result.current.value.state.historyByChannel[CHANNEL]?.hasMore).toBe(true);

        await act(async () => {
            result.current.value.loadMoreHistory(CHANNEL, 'm-init');
            await Promise.resolve();
        });

        expect(result.current.value.state.byChannel[CHANNEL]?.map((m) => m.messageId)).toEqual(['m-old', 'm-init']);
        expect(result.current.value.state.historyByChannel[CHANNEL]?.hasMore).toBe(false);
        expect(result.current.value.state.historyByChannel[CHANNEL]?.loadingMore).toBe(false);
    });

    it('loadMoreHistory sets loadMoreError on network failure', async () => {
        const msg = { messageId: 'm1', clientMessageId: 'c1', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'x', createdAt: '2026-01-01T00:00:01Z' };
        const apiGet = vi.fn()
            .mockResolvedValueOnce({ data: { data: [msg], hasMore: true } })
            .mockRejectedValueOnce(new Error('network error'));
        const { result } = render({ api: { get: apiGet } });

        fake.emit('stateChange', 'open');
        await act(async () => {
            result.current.value.loadHistory(CHANNEL);
            await Promise.resolve();
        });

        await act(async () => {
            result.current.value.loadMoreHistory(CHANNEL, 'm1');
            await Promise.resolve();
        });

        expect(result.current.value.state.historyByChannel[CHANNEL]?.loadMoreError).toBe(true);
        expect(result.current.value.state.historyByChannel[CHANNEL]?.loadingMore).toBe(false);
        expect(result.current.value.state.historyByChannel[CHANNEL]?.hasMore).toBe(true);
    });

    it('loadMoreHistory with hasMore=false does nothing', async () => {
        const msg = { messageId: 'm1', clientMessageId: 'c1', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'x', createdAt: '2026-01-01T00:00:01Z' };
        const apiGet = vi.fn()
            .mockResolvedValueOnce({ data: { data: [msg], hasMore: false } });
        const { result } = render({ api: { get: apiGet } });

        fake.emit('stateChange', 'open');
        await act(async () => {
            result.current.value.loadHistory(CHANNEL);
            await Promise.resolve();
        });

        const callsBefore = apiGet.mock.calls.length;
        await act(async () => {
            result.current.value.loadMoreHistory(CHANNEL, 'm1');
            await Promise.resolve();
        });

        expect(apiGet.mock.calls.length).toBe(callsBefore);
    });

    it('stale ?after anchor (404) triggers historyReset and reloads', async () => {
        const msg = { messageId: 'm1', clientMessageId: 'c1', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'x', createdAt: '2026-01-01T00:00:00Z' };
        const freshMsg = { messageId: 'm2', clientMessageId: 'c2', channelId: CHANNEL, serverId: 's1', authorId: 'u1', content: 'y', createdAt: '2026-01-01T00:00:01Z' };
        const apiGet = vi.fn()
            .mockResolvedValueOnce({ data: { data: [msg], hasMore: false } })
            .mockRejectedValueOnce(Object.assign(new Error('not found'), { response: { status: 404 } }))
            .mockResolvedValueOnce({ data: { data: [freshMsg], hasMore: false } });
        const { result } = render({ api: { get: apiGet } });

        fake.emit('stateChange', 'open');
        await act(async () => {
            result.current.value.loadHistory(CHANNEL);
            await Promise.resolve();
        });

        fake.emit('stateChange', 'closed');
        fake.emit('stateChange', 'open');
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(result.current.value.state.byChannel[CHANNEL]?.map((m) => m.messageId)).toEqual(['m2']);
    });

    it('hands the invalidate frames of the client to whoever subscribed, until they unsubscribe', () => {
        const { result } = render();
        const handler = vi.fn();
        const off = result.current.value.onInvalidate(handler);

        const frame = { type: 'invalidate' as const, serverId: 's1', resources: ['channels'] };
        fake.emit('invalidate', frame);
        expect(handler).toHaveBeenCalledWith(frame);

        off();
        fake.emit('invalidate', frame);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('lets subscribe to invalidate without a client: nothing ever arrives and unsubscribing is safe', () => {
        const { result } = render({ client: null });

        const off = result.current.value.onInvalidate(vi.fn());

        expect(off).not.toThrow();
    });

    it('does not fire onReconnect on the first open', () => {
        const { result } = render();
        const handler = vi.fn();
        result.current.value.onReconnect(handler);

        fake.emit('stateChange', 'connecting');
        fake.emit('stateChange', 'open');

        expect(handler).not.toHaveBeenCalled();
    });

    it('hands the voice-participants frames to whoever subscribed, until they unsubscribe', () => {
        const { result } = render();
        const handler = vi.fn();
        const off = result.current.value.onVoiceParticipants(handler);
        const frame = {
            type: 'voice-participants.updated' as const,
            serverId: 's1',
            channelId: 'c1',
            participants: [],
            syncedAt: '2026-11-05T10:00:05Z',
        };

        fake.emit('voiceParticipants', frame);
        off();
        fake.emit('voiceParticipants', frame);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(frame);
    });

    it('subscribes to voice-participants frames as a no-op when there is no client', () => {
        const { result } = render({ client: null });

        expect(() => result.current.value.onVoiceParticipants(vi.fn())()).not.toThrow();
    });

    it('fires onReconnect when the socket opens again after a drop', () => {
        const { result } = render();
        const handler = vi.fn();
        result.current.value.onReconnect(handler);
        fake.emit('stateChange', 'open');

        fake.emit('stateChange', 'reconnecting');
        fake.emit('stateChange', 'open');

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('fires onReconnect when the app comes back from the background (suspend, then open)', () => {
        const { result } = render();
        const handler = vi.fn();
        result.current.value.onReconnect(handler);
        fake.emit('stateChange', 'open');

        act(() => result.current.suspend());
        fake.emit('stateChange', 'closed');
        fake.emit('stateChange', 'open');

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('stops firing onReconnect after unsubscribing, and one failing handler does not stop the others', () => {
        const { result } = render();
        const unsubscribed = vi.fn();
        const failing = vi.fn(() => {
            throw new Error('boom');
        });
        const healthy = vi.fn();
        result.current.value.onReconnect(unsubscribed)();
        result.current.value.onReconnect(failing);
        result.current.value.onReconnect(healthy);
        fake.emit('stateChange', 'open');

        fake.emit('stateChange', 'reconnecting');
        fake.emit('stateChange', 'open');

        expect(unsubscribed).not.toHaveBeenCalled();
        expect(healthy).toHaveBeenCalledTimes(1);
    });

    describe('editing messages', () => {
        const stored = (overrides: Record<string, unknown> = {}) => ({
            messageId: 'm1', clientMessageId: 'c1', channelId: CHANNEL, serverId: 's1', authorId: 'u1',
            content: 'original', createdAt: '2026-01-01T00:00:00Z', editedAt: null, ...overrides,
        });
        const loadChannel = async (result: ReturnType<typeof render>['result']) => {
            fake.emit('stateChange', 'open');
            await act(async () => {
                result.current.value.loadHistory(CHANNEL);
                await Promise.resolve();
            });
        };
        const history = (messages: unknown[]) =>
            vi.fn().mockResolvedValue({ data: { data: messages, hasMore: false } });

        it('applies a message.updated frame to the message in the list', async () => {
            const { result } = render({ api: { get: history([stored()]) } });
            await loadChannel(result);

            fake.emit('messageUpdated', {
                type: 'message.updated', messageId: 'm1', channelId: CHANNEL, serverId: 's1', authorId: 'u1',
                content: 'corregido', editedAt: '2026-11-09T15:30:00Z',
            });

            expect(result.current.value.state.byChannel[CHANNEL]?.[0]).toMatchObject({
                content: 'corregido', editedAt: '2026-11-09T15:30:00Z',
            });
        });

        it('editMessage calls the service and shows the saved content without waiting for the frame', async () => {
            const editMessage = vi.fn().mockResolvedValue(stored({ content: 'corregido', editedAt: '2026-11-09T15:30:00Z' }));
            const { result } = render({ api: { get: history([stored()]) }, messagesService: { editMessage, deleteMessage: vi.fn() } });
            await loadChannel(result);

            await act(async () => { await result.current.value.editMessage(CHANNEL, 'm1', 'corregido'); });

            expect(editMessage).toHaveBeenCalledWith(CHANNEL, 'm1', 'corregido');
            expect(result.current.value.state.byChannel[CHANNEL]?.[0]).toMatchObject({
                content: 'corregido', editedAt: '2026-11-09T15:30:00Z',
            });
        });

        it('the frame that follows the response changes nothing: its editedAt is not newer', async () => {
            const editMessage = vi.fn().mockResolvedValue(stored({ content: 'corregido', editedAt: '2026-11-09T15:30:00Z' }));
            const { result } = render({ api: { get: history([stored()]) }, messagesService: { editMessage, deleteMessage: vi.fn() } });
            await loadChannel(result);
            await act(async () => { await result.current.value.editMessage(CHANNEL, 'm1', 'corregido'); });
            const afterResponse = result.current.value.state;

            fake.emit('messageUpdated', {
                type: 'message.updated', messageId: 'm1', channelId: CHANNEL, serverId: 's1', authorId: 'u1',
                content: 'corregido', editedAt: '2026-11-09T15:30:00Z',
            });

            expect(result.current.value.state).toBe(afterResponse);
        });

        it('editMessage with the same content leaves the message as it was', async () => {
            const editMessage = vi.fn().mockResolvedValue(stored());
            const { result } = render({ api: { get: history([stored()]) }, messagesService: { editMessage, deleteMessage: vi.fn() } });
            await loadChannel(result);
            const before = result.current.value.state;

            await act(async () => { await result.current.value.editMessage(CHANNEL, 'm1', 'original'); });

            expect(result.current.value.state.byChannel).toBe(before.byChannel);
        });

        it('editMessage rejects with the server error and leaves the message untouched', async () => {
            const failure = Object.assign(new Error('forbidden'), { response: { status: 403 } });
            const editMessage = vi.fn().mockRejectedValue(failure);
            const { result } = render({ api: { get: history([stored()]) }, messagesService: { editMessage, deleteMessage: vi.fn() } });
            await loadChannel(result);

            await act(async () => {
                await expect(result.current.value.editMessage(CHANNEL, 'm1', 'x')).rejects.toBe(failure);
            });

            expect(result.current.value.state.byChannel[CHANNEL]?.[0].content).toBe('original');
        });

        it('brings the edits it missed while offline when the socket comes back', async () => {
            const apiGet = vi.fn()
                .mockResolvedValueOnce({ data: { data: [stored()], hasMore: false } }) // initial history
                .mockResolvedValueOnce({ data: { data: [], hasMore: false } }) // ?after: nothing new
                .mockResolvedValueOnce({ // the last page again
                    data: { data: [stored({ content: 'corregido offline', editedAt: '2026-11-09T15:30:00Z' })], hasMore: false },
                });
            const { result } = render({ api: { get: apiGet } });
            await loadChannel(result);

            fake.emit('stateChange', 'reconnecting');
            fake.emit('stateChange', 'open');
            await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });

            expect(result.current.value.state.byChannel[CHANNEL]?.[0]).toMatchObject({
                content: 'corregido offline', editedAt: '2026-11-09T15:30:00Z',
            });
        });
    });

    describe('deleting messages', () => {
        const stored = (messageId: string, minute: number) => ({
            messageId, clientMessageId: `c-${messageId}`, channelId: CHANNEL, serverId: 's1', authorId: 'u1',
            content: messageId, createdAt: `2026-11-10T12:0${minute}:00Z`, editedAt: null,
        });
        const loadChannel = async (result: ReturnType<typeof render>['result']) => {
            fake.emit('stateChange', 'open');
            await act(async () => {
                result.current.value.loadHistory(CHANNEL);
                await Promise.resolve();
            });
        };
        const ids = (result: ReturnType<typeof render>['result']) =>
            result.current.value.state.byChannel[CHANNEL]?.map((m) => m.messageId);

        it('removes the message when the message.deleted frame arrives', async () => {
            const { result } = render({ api: { get: vi.fn().mockResolvedValue({ data: { data: [stored('m1', 1), stored('m2', 2)], hasMore: false } }) } });
            await loadChannel(result);

            fake.emit('messageDeleted', { type: 'message.deleted', messageId: 'm1', channelId: CHANNEL, serverId: 's1', deletedAt: '2026-11-10T13:00:00Z' });

            expect(ids(result)).toEqual(['m2']);
        });

        it('deleteMessage calls the service and removes the message without waiting for the frame', async () => {
            const deleteMessage = vi.fn().mockResolvedValue(undefined);
            const { result } = render({
                api: { get: vi.fn().mockResolvedValue({ data: { data: [stored('m1', 1), stored('m2', 2)], hasMore: false } }) },
                messagesService: { editMessage: vi.fn(), deleteMessage },
            });
            await loadChannel(result);

            await act(async () => { await result.current.value.deleteMessage(CHANNEL, 'm1'); });

            expect(deleteMessage).toHaveBeenCalledWith(CHANNEL, 'm1');
            expect(ids(result)).toEqual(['m2']);
        });

        it('deleteMessage rejects with the server error and keeps the message', async () => {
            const failure = Object.assign(new Error('forbidden'), { response: { status: 403 } });
            const { result } = render({
                api: { get: vi.fn().mockResolvedValue({ data: { data: [stored('m1', 1)], hasMore: false } }) },
                messagesService: { editMessage: vi.fn(), deleteMessage: vi.fn().mockRejectedValue(failure) },
            });
            await loadChannel(result);

            await act(async () => {
                await expect(result.current.value.deleteMessage(CHANNEL, 'm1')).rejects.toBe(failure);
            });

            expect(ids(result)).toEqual(['m1']);
        });

        it('drops what was deleted while offline when the socket comes back', async () => {
            const apiGet = vi.fn()
                .mockResolvedValueOnce({ data: { data: [stored('m1', 1), stored('m2', 2), stored('m3', 3)], hasMore: false } })
                .mockResolvedValueOnce({ data: { data: [], hasMore: false } }) // ?after: nothing new
                .mockResolvedValueOnce({ data: { data: [stored('m1', 1), stored('m3', 3)], hasMore: false } }); // last page
            const { result } = render({ api: { get: apiGet } });
            await loadChannel(result);

            fake.emit('stateChange', 'reconnecting');
            fake.emit('stateChange', 'open');
            await waitFor(() => expect(ids(result)).toEqual(['m1', 'm3']));
        });
    });
});
