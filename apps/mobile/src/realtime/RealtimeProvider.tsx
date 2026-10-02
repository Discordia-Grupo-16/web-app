import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { chatReducer, initialChatState, useAuth } from '@discordia/core';
import { createRealtimeClient } from '@discordia/api';
import { WS_URL } from '@/constants/config';
import { mobileAuthStorage } from '@/services/auth-storage';
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
      console.warn('EXPO_PUBLIC_WS_URL is not set: realtime chat is disabled.');
      return null;
    }
    return createRealtimeClient({ url: WS_URL, getToken: mobileAuthStorage.getToken });
  });
  const [status, setStatus] = useState<RealtimeStatus>(() => (client ? client.getState() : 'disabled'));
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [maxLength, setMaxLength] = useState(DEFAULT_MAX_LENGTH);
  const [lastRejected, setLastRejected] = useState<RejectedMessage | null>(null);

  const stateRef = useRef(state);
  const maxLengthRef = useRef(maxLength);
  // ReturnType: in React Native the timer handle is not necessarily a number.
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // True from the moment we close the socket for the background until it reconnects, so the banner
  // shows "Conectando…" instead of "Desconectado." when the user comes back.
  const resuming = useRef(false);

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
  // signOut() nulls the token, and the resulting redirect unmounts this provider (cleanup below).
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

  useEffect(() => {
    if (!client) return;
    if (!token) {
      client.disconnect();
      return;
    }
    client.connect();
    return () => client.disconnect();
  }, [client, token]);

  // Android may freeze the process in the background and kill the socket without a clean close, and an
  // idle socket drains battery. Only 'background' closes it: 'inactive' also fires for system dialogs on iOS.
  useEffect(() => {
    if (!client) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (token) client.connect();
      } else if (next === 'background') {
        resuming.current = true;
        client.disconnect();
      }
    });
    return () => sub.remove();
  }, [client, token]);

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
