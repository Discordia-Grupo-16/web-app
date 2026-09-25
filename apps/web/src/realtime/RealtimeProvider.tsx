import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { createRealtimeClient } from '@discordia/realtime';
import { useAuth } from '@discordia/context';
import { TOKEN_KEY, webAuthStorage } from '../services/webStorage';
import { WS_URL } from './config';
import { chatReducer, initialChatState } from './chatStore';
import { newClientMessageId } from './clientMessageId';
import { rejectionMessage } from './errorMessages';
import {
    DEFAULT_MAX_LENGTH,
    RealtimeContext,
    type RealtimeContextValue,
    type RealtimeStatus,
    type RejectedMessage,
} from './realtimeContext';

const SEND_TIMEOUT_MS = 10_000;

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    const [client] = useState(() => {
        if (!WS_URL) {
            console.warn('VITE_WS_URL is not set: realtime chat is disabled.');
            return null;
        }
        return createRealtimeClient({ url: WS_URL, getToken: webAuthStorage.getToken });
    });
    const [status, setStatus] = useState<RealtimeStatus>(() => (client ? client.getState() : 'disabled'));
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const [maxLength, setMaxLength] = useState(DEFAULT_MAX_LENGTH);
    const [lastRejected, setLastRejected] = useState<RejectedMessage | null>(null);

    const stateRef = useRef(state);
    const maxLengthRef = useRef(maxLength);
    const timers = useRef(new Map<string, number>());

    useEffect(() => {
        stateRef.current = state;
        maxLengthRef.current = maxLength;
    }, [state, maxLength]);

    const clearTimer = useCallback((clientMessageId: string | undefined) => {
        if (clientMessageId === undefined) return;
        const timer = timers.current.get(clientMessageId);
        if (timer === undefined) return;
        window.clearTimeout(timer);
        timers.current.delete(clientMessageId);
    }, []);

    const clearAllTimers = useCallback(() => {
        timers.current.forEach((timer) => window.clearTimeout(timer));
        timers.current.clear();
    }, []);

    // One socket per session. It is tied to the auth state instead of to each logout call site:
    // signOut() nulls the token, and the resulting redirect unmounts this provider (cleanup below).
    // Subscriptions are declared first so the initial 'connecting' state is not missed.
    useEffect(() => {
        if (!client) return;

        const offState = client.on('stateChange', (next) => {
            setStatus(next);
            if (next === 'reconnecting' || next === 'closed') {
                clearAllTimers();
                dispatch({ type: 'connectionLost' });
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

    // Logout in another tab of the same browser: cut this tab's socket without touching the local session.
    useEffect(() => {
        if (!client) return;
        const onStorage = (e: StorageEvent) => {
            // e.key === null means localStorage.clear()
            if ((e.key === TOKEN_KEY || e.key === null) && !localStorage.getItem(TOKEN_KEY)) {
                client.disconnect();
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [client]);

    useEffect(() => clearAllTimers, [clearAllTimers]);

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
                window.setTimeout(() => {
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
        [transmit],
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

    const value = useMemo<RealtimeContextValue>(
        () => ({ status, state, maxLength, send, retry, discard, lastRejected, clearRejected }),
        [status, state, maxLength, send, retry, discard, lastRejected, clearRejected],
    );

    return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
