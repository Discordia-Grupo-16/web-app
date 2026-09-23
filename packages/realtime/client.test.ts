import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeClient } from './client';
import type { WebSocketLike } from './client';

// Fake WebSocket implementing exactly WebSocketLike, with test-only helpers
// (open/message/remoteClose) to drive the client's handlers directly. Running
// under `environment: 'node'` (vitest.config.ts) with this fake instead of a
// real browser WebSocket is what proves the module stays DOM-free.
class FakeWebSocket implements WebSocketLike {
    static instances: FakeWebSocket[] = [];

    readyState = 0;
    sent: string[] = [];
    onopen: ((event: unknown) => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: ((event: { code: number; reason: string }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;

    constructor(public url: string) {
        FakeWebSocket.instances.push(this);
    }

    send(data: string): void {
        this.sent.push(data);
    }

    close(code = 1000, reason = ''): void {
        this.readyState = 3;
        this.onclose?.({ code, reason });
    }

    open(): void {
        this.readyState = 1;
        this.onopen?.({});
    }

    message(data: unknown): void {
        this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }

    remoteClose(code: number, reason = ''): void {
        this.readyState = 3;
        this.onclose?.({ code, reason });
    }
}

function latestSocket(): FakeWebSocket {
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    if (!socket) throw new Error('no FakeWebSocket instance was created');
    return socket;
}

// Timers are faked, but getToken() resolves through the real microtask queue.
// advanceTimersByTimeAsync interleaves both, which is what lets a scheduled
// reconnect's getToken().then(...) actually run within the same await.
async function flush(): Promise<void> {
    await vi.advanceTimersByTimeAsync(0);
}

function baseConfig(overrides: Record<string, unknown> = {}) {
    return {
        url: 'ws://localhost:8080/api/v1/ws',
        getToken: vi.fn(async () => 'token-123'),
        webSocketImpl: FakeWebSocket,
        minBackoffMs: 100,
        maxBackoffMs: 800,
        ...overrides,
    };
}

const ACK_FRAME = {
    type: 'message.ack',
    clientMessageId: 'cm-1',
    messageId: 'm-1',
    createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
});

afterEach(() => {
    vi.useRealTimers();
});

describe('connection and authentication', () => {
    it('connect() calls getToken() and opens the socket at url?access_token=<token>, url-encoded', async () => {
        const getToken = vi.fn(async () => 'a+b/c=');
        const client = createRealtimeClient(baseConfig({ getToken }));

        client.connect();
        await flush();

        expect(getToken).toHaveBeenCalledTimes(1);
        expect(latestSocket().url).toBe(
            'ws://localhost:8080/api/v1/ws?access_token=' + encodeURIComponent('a+b/c='),
        );
    });

    it('appends the token with & when the url already has a query', async () => {
        const client = createRealtimeClient(baseConfig({ url: 'ws://localhost:8080/api/v1/ws?foo=1' }));

        client.connect();
        await flush();

        expect(latestSocket().url).toBe('ws://localhost:8080/api/v1/ws?foo=1&access_token=token-123');
    });

    it('goes idle -> connecting -> open on onopen, emitting stateChange once per transition', async () => {
        const client = createRealtimeClient(baseConfig());
        const states: string[] = [];
        client.on('stateChange', (s) => states.push(s));

        expect(client.getState()).toBe('idle');
        client.connect();
        expect(client.getState()).toBe('connecting');
        await flush();
        latestSocket().open();

        expect(client.getState()).toBe('open');
        expect(states).toEqual(['connecting', 'open']);
    });

    it('connect() while connecting or open does not open a second socket', async () => {
        const client = createRealtimeClient(baseConfig());

        client.connect();
        client.connect();
        await flush();
        expect(FakeWebSocket.instances).toHaveLength(1);

        latestSocket().open();
        client.connect();
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('if getToken() resolves null, does not open a socket, goes closed, and never reconnects on its own', async () => {
        const client = createRealtimeClient(baseConfig({ getToken: vi.fn(async () => null) }));

        client.connect();
        await flush();

        expect(FakeWebSocket.instances).toHaveLength(0);
        expect(client.getState()).toBe('closed');

        await vi.advanceTimersByTimeAsync(10_000);
        expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('if getToken() rejects, goes reconnecting and retries after the backoff', async () => {
        const getToken = vi
            .fn()
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce('token-123');
        const client = createRealtimeClient(baseConfig({ getToken }));

        client.connect();
        await flush();
        expect(client.getState()).toBe('reconnecting');
        expect(FakeWebSocket.instances).toHaveLength(0);

        await vi.advanceTimersByTimeAsync(100);
        expect(getToken).toHaveBeenCalledTimes(2);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('throws a descriptive error when there is no WebSocket implementation available', () => {
        const original = (globalThis as { WebSocket?: unknown }).WebSocket;
        delete (globalThis as { WebSocket?: unknown }).WebSocket;

        try {
            expect(() => createRealtimeClient({ url: 'ws://x', getToken: vi.fn() })).toThrow(
                /no WebSocket implementation available/,
            );
        } finally {
            (globalThis as { WebSocket?: unknown }).WebSocket = original;
        }
    });
});

describe('sending', () => {
    it('sendMessage() while open sends a single MessageSendFrame with the four fields', async () => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        latestSocket().open();

        client.sendMessage({ channelId: 'c1', content: 'hola', clientMessageId: 'cm-1' });

        expect(latestSocket().sent).toEqual([
            JSON.stringify({
                type: 'message.send',
                channelId: 'c1',
                content: 'hola',
                clientMessageId: 'cm-1',
            }),
        ]);
    });

    it('sendMessage() throws and never calls send() unless the connection is open', async () => {
        const client = createRealtimeClient(baseConfig());
        const attempt = () =>
            client.sendMessage({ channelId: 'c', content: 'x', clientMessageId: '1' });

        expect(attempt).toThrow(); // idle
        client.connect();
        expect(attempt).toThrow(); // connecting
        await flush();

        latestSocket().remoteClose(1006);
        expect(client.getState()).toBe('reconnecting');
        expect(attempt).toThrow(); // reconnecting

        client.disconnect();
        expect(client.getState()).toBe('closed');
        expect(attempt).toThrow(); // closed

        expect(FakeWebSocket.instances.every((s) => s.sent.length === 0)).toBe(true);
    });

    it('sendMessage() does not validate content: empty or over 2000 chars is sent as-is', async () => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        latestSocket().open();
        const longContent = 'a'.repeat(5000);

        client.sendMessage({ channelId: 'c1', content: '', clientMessageId: 'cm-1' });
        client.sendMessage({ channelId: 'c1', content: longContent, clientMessageId: 'cm-2' });

        expect(latestSocket().sent).toHaveLength(2);
        expect(JSON.parse(latestSocket().sent[0]).content).toBe('');
        expect(JSON.parse(latestSocket().sent[1]).content).toBe(longContent);
    });
});

describe('receiving', () => {
    async function openClient() {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        const socket = latestSocket();
        socket.open();
        return { client, socket };
    }

    it('emits ack with the parsed frame on message.ack', async () => {
        const { client, socket } = await openClient();
        const onAck = vi.fn();
        client.on('ack', onAck);

        socket.message(ACK_FRAME);

        expect(onAck).toHaveBeenCalledWith(ACK_FRAME);
    });

    it('emits messageCreated with the parsed frame on message.created', async () => {
        const { client, socket } = await openClient();
        const onCreated = vi.fn();
        client.on('messageCreated', onCreated);

        const frame = {
            type: 'message.created',
            messageId: 'm-1',
            channelId: 'c1',
            serverId: 's1',
            authorId: 'u1',
            content: 'hi',
            createdAt: '2026-01-01T00:00:00.000Z',
            clientMessageId: 'cm-1',
        };
        socket.message(frame);

        expect(onCreated).toHaveBeenCalledWith(frame);
    });

    it('emits errorFrame on error, with and without details.maxLength', async () => {
        const { client, socket } = await openClient();
        const onError = vi.fn();
        client.on('errorFrame', onError);

        const withoutDetails = {
            type: 'error',
            error: { code: 'EMPTY_MESSAGE', message: 'vacio', correlationId: 'corr-1' },
        };
        const withDetails = {
            type: 'error',
            error: {
                code: 'MESSAGE_TOO_LONG',
                message: 'largo',
                correlationId: 'corr-2',
                details: { maxLength: 2000 },
            },
        };

        socket.message(withoutDetails);
        socket.message(withDetails);

        expect(onError).toHaveBeenNthCalledWith(1, withoutDetails);
        expect(onError).toHaveBeenNthCalledWith(2, withDetails);
    });

    it('ignores a frame with an unknown type without throwing or emitting', async () => {
        const { client, socket } = await openClient();
        const onAck = vi.fn();
        const onCreated = vi.fn();
        const onError = vi.fn();
        client.on('ack', onAck);
        client.on('messageCreated', onCreated);
        client.on('errorFrame', onError);

        expect(() => socket.message({ type: 'future.frame' })).not.toThrow();

        expect(onAck).not.toHaveBeenCalled();
        expect(onCreated).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it('ignores invalid JSON without throwing and keeps the connection open', async () => {
        const { client, socket } = await openClient();

        expect(() => socket.message('not json{')).not.toThrow();
        expect(client.getState()).toBe('open');
    });

    it('a handler that throws does not stop the other handlers for the same event', async () => {
        const { client, socket } = await openClient();
        const throwing = vi.fn(() => {
            throw new Error('boom');
        });
        const ok = vi.fn();
        client.on('ack', throwing);
        client.on('ack', ok);

        expect(() => socket.message(ACK_FRAME)).not.toThrow();
        expect(ok).toHaveBeenCalledWith(ACK_FRAME);
    });
});

describe('reconnection', () => {
    it('an unrequested close (1006) goes reconnecting and reconnects after minBackoffMs, calling getToken() again', async () => {
        const getToken = vi.fn(async () => 'token-123');
        const client = createRealtimeClient(baseConfig({ getToken }));

        client.connect();
        await flush();
        latestSocket().open();

        latestSocket().remoteClose(1006);
        expect(client.getState()).toBe('reconnecting');
        expect(getToken).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(100);
        expect(getToken).toHaveBeenCalledTimes(2);
        expect(FakeWebSocket.instances).toHaveLength(2);
    });

    it('backoff grows exponentially on consecutive failures and caps at maxBackoffMs', async () => {
        const client = createRealtimeClient(baseConfig());

        client.connect();
        await flush(); // attempt #1
        latestSocket().remoteClose(1006); // failure -> wait 100ms, backoff becomes 200

        await vi.advanceTimersByTimeAsync(100);
        expect(FakeWebSocket.instances).toHaveLength(2); // attempt #2
        latestSocket().remoteClose(1006); // -> wait 200ms, backoff becomes 400

        await vi.advanceTimersByTimeAsync(199);
        expect(FakeWebSocket.instances).toHaveLength(2); // not yet
        await vi.advanceTimersByTimeAsync(1);
        expect(FakeWebSocket.instances).toHaveLength(3); // attempt #3
        latestSocket().remoteClose(1006); // -> wait 400ms, backoff becomes 800

        await vi.advanceTimersByTimeAsync(400);
        expect(FakeWebSocket.instances).toHaveLength(4); // attempt #4
        latestSocket().remoteClose(1006); // -> wait 800ms (capped), stays 800

        await vi.advanceTimersByTimeAsync(800);
        expect(FakeWebSocket.instances).toHaveLength(5); // attempt #5: proves the cap held at 800, not 1600
    });

    it('resets the backoff to minBackoffMs after a successful open', async () => {
        const client = createRealtimeClient(baseConfig());

        client.connect();
        await flush();
        latestSocket().remoteClose(1006); // -> wait 100ms, backoff becomes 200

        await vi.advanceTimersByTimeAsync(100);
        latestSocket().open(); // success resets backoff to 100

        latestSocket().remoteClose(1006); // should wait 100ms again, not 200ms
        await vi.advanceTimersByTimeAsync(99);
        expect(FakeWebSocket.instances).toHaveLength(2); // not yet at 99ms
        await vi.advanceTimersByTimeAsync(1);
        expect(FakeWebSocket.instances).toHaveLength(3); // fired at 100ms
    });

    it('calls getToken() again on every retry and connects with whatever it returns', async () => {
        const getToken = vi
            .fn()
            .mockResolvedValueOnce('token-1')
            .mockResolvedValueOnce('token-2');
        const client = createRealtimeClient(baseConfig({ getToken }));

        client.connect();
        await flush();
        expect(latestSocket().url).toContain('access_token=token-1');

        latestSocket().remoteClose(1006);
        await vi.advanceTimersByTimeAsync(100);

        expect(getToken).toHaveBeenCalledTimes(2);
        expect(latestSocket().url).toContain('access_token=token-2');
    });

    it.each([1001, 1011])('a close with code %i also triggers a reconnect', async (code) => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        latestSocket().open();

        latestSocket().remoteClose(code);
        expect(client.getState()).toBe('reconnecting');

        await vi.advanceTimersByTimeAsync(100);
        expect(FakeWebSocket.instances).toHaveLength(2);
    });
});

describe('deliberate close', () => {
    it('disconnect() while open closes with code 1000, goes closed, and the resulting onclose does not reconnect', async () => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        const socket = latestSocket();
        socket.open();

        client.disconnect();

        expect(socket.readyState).toBe(3);
        expect(socket.sent).toEqual([]);
        expect(client.getState()).toBe('closed');

        await vi.advanceTimersByTimeAsync(10_000);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('disconnect() while reconnecting cancels the pending timer: no socket is created afterwards', async () => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        latestSocket().remoteClose(1006); // now reconnecting, a timer is pending

        client.disconnect();
        expect(client.getState()).toBe('closed');

        await vi.advanceTimersByTimeAsync(10_000);
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('disconnect() while getToken() is pending prevents opening a socket once it resolves', async () => {
        let resolveToken!: (token: string | null) => void;
        const getToken = vi.fn(() => new Promise<string | null>((resolve) => (resolveToken = resolve)));
        const client = createRealtimeClient(baseConfig({ getToken }));

        client.connect();
        client.disconnect();
        expect(client.getState()).toBe('closed');

        resolveToken('token-123');
        await flush();

        expect(FakeWebSocket.instances).toHaveLength(0);
        expect(client.getState()).toBe('closed');
    });

    it('connect() after disconnect() reconnects normally', async () => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        latestSocket().open();

        client.disconnect();
        expect(client.getState()).toBe('closed');

        client.connect();
        await flush();
        expect(FakeWebSocket.instances).toHaveLength(2);

        latestSocket().open();
        expect(client.getState()).toBe('open');
    });
});

describe('stale attempt guards (races between superseded and current connections)', () => {
    it('a stale onopen from a superseded attempt does not touch state or reset backoff', async () => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        const staleSocket = latestSocket();

        client.disconnect();
        client.connect();
        await flush();
        const currentSocket = latestSocket();
        expect(currentSocket).not.toBe(staleSocket);

        staleSocket.open(); // late onopen from the superseded attempt
        expect(client.getState()).toBe('connecting'); // unaffected

        currentSocket.open();
        expect(client.getState()).toBe('open');
    });

    it('a message from a superseded attempt is ignored', async () => {
        const client = createRealtimeClient(baseConfig());
        const onAck = vi.fn();
        client.on('ack', onAck);

        client.connect();
        await flush();
        const staleSocket = latestSocket();
        staleSocket.open();

        client.disconnect();
        client.connect();
        await flush();
        latestSocket().open();

        staleSocket.message(ACK_FRAME); // arrives late, from the superseded socket
        expect(onAck).not.toHaveBeenCalled();
    });

    it('a close from a superseded attempt does not clear the current socket or schedule a reconnect', async () => {
        const client = createRealtimeClient(baseConfig());
        client.connect();
        await flush();
        const staleSocket = latestSocket();

        client.disconnect();
        client.connect();
        await flush();
        latestSocket().open();

        staleSocket.remoteClose(1006); // late close from the superseded socket
        expect(client.getState()).toBe('open');

        await vi.advanceTimersByTimeAsync(10_000);
        expect(FakeWebSocket.instances).toHaveLength(2); // no extra reconnect triggered
    });

    it('a rejected getToken() from a superseded attempt does not schedule a reconnect', async () => {
        let rejectToken!: (err: Error) => void;
        const getToken = vi
            .fn()
            .mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectToken = reject)))
            .mockResolvedValueOnce('token-123');
        const client = createRealtimeClient(baseConfig({ getToken }));

        client.connect(); // attempt #1, getToken() left pending
        client.disconnect();
        client.connect(); // attempt #2
        await flush();
        latestSocket().open();

        rejectToken(new Error('late failure')); // attempt #1's getToken() rejects after being superseded
        await flush();

        expect(client.getState()).toBe('open');
        expect(FakeWebSocket.instances).toHaveLength(1);
    });
});

describe('subscriptions', () => {
    it('the function returned by on() unsubscribes that handler only', async () => {
        const client = createRealtimeClient(baseConfig());
        const first = vi.fn();
        const second = vi.fn();
        const unsubscribeFirst = client.on('ack', first);
        client.on('ack', second);

        client.connect();
        await flush();
        latestSocket().open();

        unsubscribeFirst();
        latestSocket().message(ACK_FRAME);

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledWith(ACK_FRAME);
    });
});
