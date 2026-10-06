import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { RealtimeClient } from '@discordia/api';
import { chatReducer, initialChatState, type ChatMessage } from './chatStore';
import { rejectionMessage } from './errorMessages';
import {
    DEFAULT_MAX_LENGTH,
    type RealtimeContextValue,
    type RealtimeStatus,
    type RejectedMessage,
} from './realtimeContext';

interface HistoryApiResponse {
    messages: ChatMessage[];
    hasMore: boolean;
}

interface HttpClient {
    get<T>(url: string, config?: { params?: Record<string, string | undefined> }): Promise<{ data: T }>;
}

const SEND_TIMEOUT_MS = 10_000;

export interface RealtimeControllerOptions {
    /** null when realtime is disabled (no WebSocket URL configured). */
    client: RealtimeClient | null;
    /** The socket is open while there is a token and closed when it goes away (logout). */
    token: string | null;
    /** Platform-specific: crypto.randomUUID is not available everywhere (insecure origins, Hermes). */
    newClientMessageId: () => string;
    /** Axios-compatible client for history and resync HTTP calls. */
    api: HttpClient;
}

export interface RealtimeController {
    value: RealtimeContextValue;
    /**
     * Closes the socket on purpose (e.g. the app went to the background). Until the next connect the
     * status reads 'connecting' instead of 'closed', so the banner does not flash "Desconectado.".
     */
    suspend: () => void;
}

// Everything the realtime providers share: the chat state, the per-message send timeouts and how
// server frames map to it. Each app wraps it in a provider that adds its own lifecycle (storage
// events on the web, AppState on mobile) and renders RealtimeContext with `value`.
export const useRealtimeController = ({
    client,
    token,
    newClientMessageId,
    api,
}: RealtimeControllerOptions): RealtimeController => {
    const [status, setStatus] = useState<RealtimeStatus>(() => (client ? client.getState() : 'disabled'));
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const [maxLength, setMaxLength] = useState(DEFAULT_MAX_LENGTH);
    const [lastRejected, setLastRejected] = useState<RejectedMessage | null>(null);

    const stateRef = useRef(state);
    const maxLengthRef = useRef(maxLength);
    // ReturnType: in React Native the timer handle is not necessarily a number.
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    // True from suspend() until the socket reconnects (see suspend).
    const resuming = useRef(false);
    const historyFetching = useRef(new Set<string>());
    const wasReconnecting = useRef(false);

    useEffect(() => {
        stateRef.current = state;
        maxLengthRef.current = maxLength;
    }, [state, maxLength]);

    const clearTimer = useCallback((clientMessageId: string | undefined) => {
        if (clientMessageId === undefined) return;
        const timer = timers.current.get(clientMessageId);
        if (timer === undefined) return;
        clearTimeout(timer);
        timers.current.delete(clientMessageId);
    }, []);

    const clearAllTimers = useCallback(() => {
        timers.current.forEach((timer) => clearTimeout(timer));
        timers.current.clear();
    }, []);

    // One socket per session. It is tied to the auth state instead of to each logout call site:
    // signOut() nulls the token, and the resulting redirect unmounts the provider (cleanup below).
    // Subscriptions are declared first so the initial 'connecting' state is not missed.
    useEffect(() => {
        if (!client) return;

        const offState = client.on('stateChange', (next) => {
            if (next === 'reconnecting') wasReconnecting.current = true;
            if (next === 'closed') wasReconnecting.current = false;
            if (next !== 'closed') resuming.current = false;
            setStatus(resuming.current ? 'connecting' : next);
            if (next === 'reconnecting' || next === 'closed') {
                clearAllTimers();
                dispatch({ type: 'connectionLost' });
            }
            if (next === 'open' && wasReconnecting.current) {
                wasReconnecting.current = false;
                for (const [channelId, messages] of Object.entries(stateRef.current.byChannel)) {
                    const lastMsg = messages[messages.length - 1];
                    if (!lastMsg) continue;
                    api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`, { params: { after: lastMsg.messageId } })
                        .then(({ data }) => {
                            if (data.messages.length > 0) {
                                dispatch({ type: 'resyncLoaded', channelId, messages: data.messages });
                            }
                        })
                        .catch((err) => console.error('resync channel failed', channelId, err));
                }
            }
        });
        const offAck = client.on('ack', (frame) => {
            clearTimer(frame.clientMessageId);
            dispatch({ type: 'ack', frame });
        });
        const offCreated = client.on('messageCreated', (frame) => {
            clearTimer(frame.clientMessageId);
            dispatch({ type: 'created', frame });
        });
        const offError = client.on('errorFrame', (frame) => {
            const head = stateRef.current.awaitingResponse[0];
            clearTimer(head);
            const { code, details } = frame.error;
            const rejected = head === undefined ? undefined : stateRef.current.pending[head];

            if (rejected && (code === 'EMPTY_MESSAGE' || code === 'MESSAGE_TOO_LONG')) {
                // Nothing the user can retry: drop the pending and hand the text back to the composer.
                const limit = (code === 'MESSAGE_TOO_LONG' && details?.maxLength) || maxLengthRef.current;
                if (limit !== maxLengthRef.current) setMaxLength(limit);
                setLastRejected({
                    channelId: rejected.channelId,
                    content: rejected.content,
                    code,
                    message: rejectionMessage(code, limit),
                });
                dispatch({ type: 'discard', clientMessageId: rejected.clientMessageId });
                return;
            }
            dispatch({ type: 'error', frame });
        });

        return () => {
            offState();
            offAck();
            offCreated();
            offError();
        };
    }, [client, clearTimer, clearAllTimers]);

    // StrictMode runs this effect twice in dev: connect() is idempotent and works after disconnect().
    useEffect(() => {
        if (!client) return;
        if (!token) {
            client.disconnect();
            return;
        }
        client.connect();
        return () => client.disconnect();
    }, [client, token]);

    useEffect(() => clearAllTimers, [clearAllTimers]);

    const suspend = useCallback(() => {
        if (!client) return;
        resuming.current = true;
        client.disconnect();
    }, [client]);

    const transmit = useCallback(
        (clientMessageId: string, channelId: string, content: string) => {
            try {
                if (!client) throw new Error('realtime disabled');
                client.sendMessage({ channelId, content, clientMessageId });
            } catch {
                // sendMessage throws when the socket is not open (a race with the disabled send button).
                dispatch({ type: 'sendFailed', clientMessageId });
                return;
            }
            clearTimer(clientMessageId);
            timers.current.set(
                clientMessageId,
                setTimeout(() => {
                    timers.current.delete(clientMessageId);
                    dispatch({ type: 'timeout', clientMessageId });
                }, SEND_TIMEOUT_MS),
            );
        },
        [client, clearTimer],
    );

    const send = useCallback(
        (channelId: string, content: string) => {
            const clientMessageId = newClientMessageId();
            dispatch({ type: 'sent', clientMessageId, channelId, content });
            transmit(clientMessageId, channelId, content);
        },
        [transmit, newClientMessageId],
    );

    const retry = useCallback(
        (clientMessageId: string) => {
            const message = stateRef.current.pending[clientMessageId];
            if (!message || message.status !== 'failed') return;
            dispatch({ type: 'resent', clientMessageId });
            // Same clientMessageId: if the first attempt was actually persisted, the server answers with the existing ack.
            transmit(clientMessageId, message.channelId, message.content);
        },
        [transmit],
    );

    const discard = useCallback(
        (clientMessageId: string) => {
            clearTimer(clientMessageId);
            dispatch({ type: 'discard', clientMessageId });
        },
        [clearTimer],
    );

    const clearRejected = useCallback(() => setLastRejected(null), []);

    const loadHistory = useCallback(async (channelId: string) => {
        if (stateRef.current.historyByChannel[channelId]?.loaded) return;
        if (historyFetching.current.has(channelId)) return;
        historyFetching.current.add(channelId);
        try {
            const { data } = await api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`);
            dispatch({ type: 'historyLoaded', channelId, messages: data.messages, hasMore: data.hasMore });
        } catch (err) {
            console.error('loadHistory failed', channelId, err);
            dispatch({ type: 'historyLoaded', channelId, messages: [], hasMore: false });
        } finally {
            historyFetching.current.delete(channelId);
        }
    }, [api]);

    const loadMoreHistory = useCallback(async (channelId: string, beforeId: string) => {
        const hist = stateRef.current.historyByChannel[channelId];
        if (!hist?.hasMore || hist.loadingMore) return;
        if (historyFetching.current.has(`more:${channelId}`)) return;
        historyFetching.current.add(`more:${channelId}`);
        dispatch({ type: 'loadingMoreHistory', channelId });
        try {
            const { data } = await api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`, {
                params: { before: beforeId },
            });
            dispatch({ type: 'moreHistoryLoaded', channelId, messages: data.messages, hasMore: data.hasMore });
        } catch (err) {
            console.error('loadMoreHistory failed', channelId, err);
            const current = stateRef.current.historyByChannel[channelId];
            dispatch({ type: 'moreHistoryLoaded', channelId, messages: [], hasMore: current?.hasMore ?? false });
        } finally {
            historyFetching.current.delete(`more:${channelId}`);
        }
    }, [api]);

    const value = useMemo<RealtimeContextValue>(
        () => ({ status, state, maxLength, send, retry, discard, lastRejected, clearRejected, loadHistory, loadMoreHistory }),
        [status, state, maxLength, send, retry, discard, lastRejected, clearRejected, loadHistory, loadMoreHistory],
    );

    return { value, suspend };
};
