import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { createRealtimeClient } from '@discordia/api';
import { RealtimeContext, useAuth, useRealtimeController } from '@discordia/core';
import { WS_URL } from '@/shared/config/env';
import { mobileAuthStorage } from '@/shared/session/authStorage';
import { newClientMessageId } from './clientMessageId';

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const { token } = useAuth();
  const [client] = useState(() => {
    if (!WS_URL) {
      console.warn('EXPO_PUBLIC_WS_URL is not set: realtime chat is disabled.');
      return null;
    }
    return createRealtimeClient({ url: WS_URL, getToken: mobileAuthStorage.getToken });
  });
  const { value, suspend } = useRealtimeController({ client, token, newClientMessageId });

  // Android may freeze the process in the background and kill the socket without a clean close, and an
  // idle socket drains battery. Only 'background' closes it: 'inactive' also fires for system dialogs on iOS.
  useEffect(() => {
    if (!client) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        if (token) client.connect();
      } else if (next === 'background') {
        suspend();
      }
    });
    return () => sub.remove();
  }, [client, token, suspend]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
