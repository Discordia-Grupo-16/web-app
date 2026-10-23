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
    data: ChatMessage[];
    hasMore: boolean;
}

interface HttpClient {
    get<T>(url: string, config?: { params?: Record<string, string | undefined> }): Promise<{ data: T }>;
}

export interface Logger {
    error(...args: unknown[]): void;
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
    /** Error reporter. Pass `console` from the platform provider. */
    logger: Logger;
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
    logger,
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
    const loadMoreFetching = useRef(new Set<string>());
    const syncAbortRef = useRef<AbortController | null>(null);
    const MAX_RESYNC_PAGES = 20;

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
            if (next !== 'closed') resuming.current = false;
            setStatus(resuming.current ? 'connecting' : next);
            if (next === 'reconnecting' || next === 'closed') {
                clearAllTimers();
                dispatch({ type: 'connectionLost' });
            }
            if (next === 'open') {
                // Cancel any in-progress resync and start a fresh one.
                syncAbortRef.current?.abort();
                const abort = new AbortController();
                syncAbortRef.current = abort;
                for (const [channelId, hist] of Object.entries(stateRef.current.historyByChannel)) {
                    if (!hist.loaded) {
                        // Channel was reset (stale anchor) or aborted mid-reload; reload it now.
                        if (!hist.error && !historyFetching.current.has(channelId)) {
                            historyFetching.current.add(channelId);
                            (async () => {
                                try {
                                    const { data } = await api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`);
                                    if (abort.signal.aborted) return;
                                    dispatch({ type: 'historyLoaded', channelId, messages: data.data, hasMore: data.hasMore });
                                } catch { /* keep existing state */ }
                                finally { historyFetching.current.delete(channelId); }
                            })();
                        }
                        continue;
                    }
                    const messages = stateRef.current.byChannel[channelId] ?? [];
                    const lastMsg = messages[messages.length - 1];
                    if (!lastMsg) {
                        // Channel loaded but empty: reload initial history to fill the gap.
                        if (!historyFetching.current.has(channelId)) {
                            historyFetching.current.add(channelId);
                            (async () => {
                                try {
                                    const { data } = await api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`);
                                    if (abort.signal.aborted) return;
                                    dispatch({ type: 'historyLoaded', channelId, messages: data.data, hasMore: data.hasMore });
                                } catch { /* keep existing state */ }
                                finally { historyFetching.current.delete(channelId); }
                            })();
                        }
                        continue;
                    }
                    (async () => {
                        let afterId = lastMsg.messageId;
                        for (let page = 0; page < MAX_RESYNC_PAGES; page++) {
                            if (abort.signal.aborted) return;
                            let resp: HistoryApiResponse;
                            try {
                                const { data } = await api.get<HistoryApiResponse>(
                                    `/api/v1/channels/${channelId}/messages`,
                                    { params: { after: afterId } },
                                );
                                resp = data;
                            } catch (err: unknown) {
                                const httpStatus = (err as { response?: { status?: number } })?.response?.status;
                                if (httpStatus === 404 || httpStatus === 410) {
                                    if (abort.signal.aborted || historyFetching.current.has(channelId)) return;
                                    historyFetching.current.add(channelId);
                                    dispatch({ type: 'historyReset', channelId });
                                    try {
                                        const { data } = await api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`);
                                        if (abort.signal.aborted) return;
                                        dispatch({ type: 'historyLoaded', channelId, messages: data.data, hasMore: data.hasMore });
                                    } catch (reloadErr) {
                                        logger.error('history reload after stale anchor failed', channelId, reloadErr);
                                    } finally {
                                        historyFetching.current.delete(channelId);
                                    }
                                } else {
                                    logger.error('resync channel failed', channelId, err);
                                }
                                return;
                            }
                            if (abort.signal.aborted) return;
                            if (resp.data.length > 0) {
                                dispatch({ type: 'resyncLoaded', channelId, messages: resp.data });
                            }
                            if (!resp.hasMore || resp.data.length === 0) return;
                            afterId = resp.data[resp.data.length - 1].messageId;
                        }
                        logger.error('resync reached max pages without exhausting messages', channelId, { maxPages: MAX_RESYNC_PAGES });
                    })();
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
            syncAbortRef.current?.abort();
        };
    }, [client, clearTimer, clearAllTimers, logger]);

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
            dispatch({ type: 'historyLoaded', channelId, messages: data.data, hasMore: data.hasMore });
        } catch (err) {
            logger.error('loadHistory failed', channelId, err);
            dispatch({ type: 'historyFailed', channelId });
        } finally {
            historyFetching.current.delete(channelId);
        }
    }, [api, logger]);

    const retryHistory = useCallback((channelId: string) => {
        dispatch({ type: 'historyRetry', channelId });
        historyFetching.current.delete(channelId);
        loadHistory(channelId);
    }, [loadHistory]);

    const loadMoreHistory = useCallback(async (channelId: string, beforeId: string) => {
        const hist = stateRef.current.historyByChannel[channelId];
        if (!hist?.hasMore || hist.loadingMore) return;
        if (loadMoreFetching.current.has(channelId)) return;
        loadMoreFetching.current.add(channelId);
        dispatch({ type: 'loadingMoreHistory', channelId });
        try {
            const { data } = await api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`, {
                params: { before: beforeId },
            });
            dispatch({ type: 'moreHistoryLoaded', channelId, messages: data.data, hasMore: data.hasMore });
        } catch (err: unknown) {
            const httpStatus = (err as { response?: { status?: number } })?.response?.status;
            if (httpStatus === 404) {
                dispatch({ type: 'historyReset', channelId });
                try {
                    const { data } = await api.get<HistoryApiResponse>(`/api/v1/channels/${channelId}/messages`);
                    dispatch({ type: 'historyLoaded', channelId, messages: data.data, hasMore: data.hasMore });
                } catch (reloadErr) {
                    logger.error('loadMoreHistory 404 reload failed', channelId, reloadErr);
                }
                return;
            }
            logger.error('loadMoreHistory failed', channelId, err);
            dispatch({ type: 'loadMoreFailed', channelId });
        } finally {
            loadMoreFetching.current.delete(channelId);
        }
    }, [api, logger]);

    const value = useMemo<RealtimeContextValue>(
        () => ({ status, state, maxLength, send, retry, discard, lastRejected, clearRejected, loadHistory, retryHistory, loadMoreHistory }),
        [status, state, maxLength, send, retry, discard, lastRejected, clearRejected, loadHistory, retryHistory, loadMoreHistory],
    );

    return { value, suspend };
};
