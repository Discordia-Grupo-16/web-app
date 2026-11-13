import type {
    ErrorFrame,
    InvalidateFrame,
    MessageAckFrame,
    MessageCreatedFrame,
    MessageUpdatedFrame,
    MessageDeletedFrame,
    ReadStateUpdatedFrame,
    ServerFrame,
    VoiceParticipantsUpdatedFrame,
} from './protocol';

// Minimal surface the client needs from a WebSocket. Declared here instead of
// using lib.dom.d.ts's WebSocket so this package compiles without `lib: DOM`
// and works unchanged in React Native, which has no DOM WebSocket.
interface WebSocketLike {
    readonly readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    onopen: ((event: unknown) => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onclose: ((event: { code: number; reason: string }) => void) | null;
    onerror: ((event: unknown) => void) | null;
}

type WebSocketConstructor = new (url: string) => WebSocketLike;

// Local literal instead of WebSocket.OPEN, which depends on the DOM global.
const READY_STATE_OPEN = 1;

// setTimeout/clearTimeout come from lib.dom.d.ts or @types/node, neither of
// which this package depends on. Declaring them locally (module-scoped, not
// `declare global`) keeps the file type-checking without DOM while leaving
// other files' view of the real global untouched. Both the browser and React
// Native provide a numeric timer handle at runtime.
declare function setTimeout(handler: () => void, timeoutMs: number): number;
declare function clearTimeout(id: number): void;

/** chat.yaml: 4400-4499 are terminal, the client must not reconnect. */
export const CLOSE_ACCOUNT_SUSPENDED = 4403;

export function isTerminalCloseCode(code: number): boolean {
    return code >= 4400 && code <= 4499;
}

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface RealtimeClientConfig {
    /** Gateway WebSocket endpoint, without the ticket. E.g. ws://localhost:8080/api/v1/ws */
    url: string;
    /** Called on every connection attempt: a ticket is single-use (30 s), so each handshake needs a fresh one. null = no session, the client closes. */
    getTicket: () => Promise<string | null>;
    /** Injectable for tests or environments without a global WebSocket. Default: globalThis.WebSocket. */
    webSocketImpl?: WebSocketConstructor;
    /** Default 500. Do not lower it: every handshake counts against the gateway rate limit. */
    minBackoffMs?: number;
    /** Default 15000. */
    maxBackoffMs?: number;
}

export interface SendMessageInput {
    channelId: string;
    content: string;
    clientMessageId: string;
}

export interface RealtimeEventMap {
    stateChange: (state: ConnectionState) => void;
    ack: (frame: MessageAckFrame) => void;
    messageCreated: (frame: MessageCreatedFrame) => void;
    messageUpdated: (frame: MessageUpdatedFrame) => void;
    messageDeleted: (frame: MessageDeletedFrame) => void;
    invalidate: (frame: InvalidateFrame) => void;
    voiceParticipants: (frame: VoiceParticipantsUpdatedFrame) => void;
    readStateUpdated: (frame: ReadStateUpdatedFrame) => void;
    errorFrame: (frame: ErrorFrame) => void;
    terminated: (event: { code: number; reason: string }) => void;
}

export interface RealtimeClient {
    connect(): void;
    disconnect(): void;
    sendMessage(input: SendMessageInput): void;
    getState(): ConnectionState;
    on<K extends keyof RealtimeEventMap>(event: K, handler: RealtimeEventMap[K]): () => void;
}

const DEFAULT_MIN_BACKOFF_MS = 500;
const DEFAULT_MAX_BACKOFF_MS = 15000;

function resolveWebSocketImpl(injected?: WebSocketConstructor): WebSocketConstructor {
    const impl = injected ?? (globalThis as { WebSocket?: WebSocketConstructor }).WebSocket;
    if (!impl) {
        throw new Error(
            '@discordia/api realtime: no WebSocket implementation available. Pass webSocketImpl or run in an environment with a global WebSocket.',
        );
    }
    return impl;
}

// Builds the query manually instead of `new URL(...).searchParams`: React
// Native's URL polyfill can throw "not implemented" on searchParams.set, and
// this module has to work unchanged on mobile.
function buildConnectionUrl(baseUrl: string, ticket: string): string {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}ticket=${encodeURIComponent(ticket)}`;
}

export function createRealtimeClient(config: RealtimeClientConfig): RealtimeClient {
    const {
        url,
        getTicket,
        webSocketImpl,
        minBackoffMs = DEFAULT_MIN_BACKOFF_MS,
        maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
    } = config;

    // Resolved eagerly so a missing WebSocket implementation fails at
    // createRealtimeClient() instead of silently at the first connect().
    const WebSocketImpl = resolveWebSocketImpl(webSocketImpl);

    let state: ConnectionState = 'idle';
    let socket: WebSocketLike | null = null;
    let backoffMs = minBackoffMs;
    let reconnectTimer: number | null = null;
    let deliberateClose = false;
    let connectAttemptId = 0;

    const listeners: { [K in keyof RealtimeEventMap]: Set<RealtimeEventMap[K]> } = {
        stateChange: new Set(),
        ack: new Set(),
        messageCreated: new Set(),
        messageUpdated: new Set(),
        messageDeleted: new Set(),
        invalidate: new Set(),
        voiceParticipants: new Set(),
        readStateUpdated: new Set(),
        errorFrame: new Set(),
        terminated: new Set(),
    };

    function emit<K extends keyof RealtimeEventMap>(
        event: K,
        ...args: Parameters<RealtimeEventMap[K]>
    ): void {
        for (const handler of listeners[event]) {
            try {
                (handler as (...a: Parameters<RealtimeEventMap[K]>) => void)(...args);
            } catch {
                // A misbehaving handler must not break the others or the client.
            }
        }
    }

    function setState(next: ConnectionState): void {
        if (state === next) return;
        state = next;
        emit('stateChange', state);
    }

    function clearReconnectTimer(): void {
        if (reconnectTimer !== null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function scheduleReconnect(): void {
        setState('reconnecting');
        clearReconnectTimer();
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            openSocket();
        }, backoffMs);
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
    }

    function attachHandlers(ws: WebSocketLike, attemptId: number): void {
        ws.onopen = () => {
            if (attemptId !== connectAttemptId) return;
            backoffMs = minBackoffMs;
            setState('open');
        };

        ws.onmessage = (event) => {
            if (attemptId !== connectAttemptId) return;
            let frame: ServerFrame;
            try {
                frame = JSON.parse(event.data as string) as ServerFrame;
            } catch {
                return;
            }
            switch (frame.type) {
                case 'message.ack':
                    emit('ack', frame);
                    break;
                case 'message.created':
                    emit('messageCreated', frame);
                    break;
                case 'message.updated':
                    // Without these fields there is nothing to apply or to order the edit by.
                    if (
                        typeof frame.messageId === 'string' &&
                        typeof frame.channelId === 'string' &&
                        typeof frame.content === 'string' &&
                        typeof frame.editedAt === 'string'
                    ) {
                        emit('messageUpdated', frame);
                    }
                    break;
                case 'message.deleted':
                    // Without these there is nothing to remove.
                    if (typeof frame.messageId === 'string' && typeof frame.channelId === 'string') {
                        emit('messageDeleted', frame);
                    }
                    break;
                case 'invalidate':
                    // Without a resource list there is nothing to refetch; an unknown resource
                    // is not filtered here, it is the subscriber that knows what it has loaded.
                    if (Array.isArray(frame.resources)) emit('invalidate', frame);
                    break;
                case 'voice-participants.updated':
                    // Without these fields the frame cannot be placed or compared; the subscriber
                    // only filters by server and by syncedAt.
                    if (
                        typeof frame.serverId === 'string' &&
                        typeof frame.channelId === 'string' &&
                        typeof frame.syncedAt === 'string' &&
                        Array.isArray(frame.participants)
                    ) {
                        emit('voiceParticipants', frame);
                    }
                    break;
                case 'read-state.updated':
                    // Without a list there is nothing to apply.
                    if (Array.isArray(frame.states)) emit('readStateUpdated', frame);
                    break;
                case 'error':
                    emit('errorFrame', frame);
                    break;
                default:
                // Unknown frame type: ignore so an older client survives protocol additions.
            }
        };

        ws.onclose = (event) => {
            if (attemptId !== connectAttemptId) return;
            socket = null;
            // Terminal codes (4400-4499): the server rejected us for good, so
            // retrying would loop. The app decides what to do (e.g. sign out).
            if (isTerminalCloseCode(event.code)) {
                clearReconnectTimer();
                setState('closed');
                emit('terminated', { code: event.code, reason: event.reason });
                return;
            }
            if (deliberateClose) return;
            scheduleReconnect();
        };

        // Errors surface as a subsequent close; nothing to do here beyond
        // letting onclose drive the reconnect.
        ws.onerror = () => {};
    }

    function openSocket(): void {
        const attemptId = connectAttemptId;
        setState('connecting');

        Promise.resolve(getTicket())
            .then((ticket) => {
                if (attemptId !== connectAttemptId || deliberateClose) return;

                if (ticket === null) {
                    setState('closed');
                    return;
                }

                const ws = new WebSocketImpl(buildConnectionUrl(url, ticket));
                attachHandlers(ws, attemptId);
                socket = ws;
            })
            .catch(() => {
                if (attemptId !== connectAttemptId || deliberateClose) return;
                scheduleReconnect();
            });
    }

    function connect(): void {
        if (state === 'connecting' || state === 'open' || state === 'reconnecting') return;
        deliberateClose = false;
        connectAttemptId += 1;
        backoffMs = minBackoffMs;
        setState('connecting');
        openSocket();
    }

    function disconnect(): void {
        deliberateClose = true;
        connectAttemptId += 1;
        clearReconnectTimer();
        if (socket) {
            socket.close(1000, 'client disconnect');
            socket = null;
        }
        setState('closed');
    }

    function sendMessage(input: SendMessageInput): void {
        if (state !== 'open' || !socket || socket.readyState !== READY_STATE_OPEN) {
            throw new Error('@discordia/api realtime: cannot send a message while the connection is not open.');
        }
        socket.send(
            JSON.stringify({
                type: 'message.send',
                channelId: input.channelId,
                content: input.content,
                clientMessageId: input.clientMessageId,
            }),
        );
    }

    function getState(): ConnectionState {
        return state;
    }

    function on<K extends keyof RealtimeEventMap>(
        event: K,
        handler: RealtimeEventMap[K],
    ): () => void {
        listeners[event].add(handler);
        return () => {
            listeners[event].delete(handler);
        };
    }

    return { connect, disconnect, sendMessage, getState, on };
}

export type { WebSocketConstructor, WebSocketLike };
