// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
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

        rerender({ client: fake.client, token: null, newClientMessageId: () => 'x' });
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
});
