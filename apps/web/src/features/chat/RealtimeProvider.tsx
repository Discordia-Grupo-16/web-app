import { useEffect, useState, type ReactNode } from 'react';
import { createRealtimeClient } from '@discordia/api';
import { RealtimeContext, useAuth, useRealtimeController } from '@discordia/core';
import { TOKEN_KEY, webAuthStorage } from '@/shared/session/authStorage';
import { WS_URL } from '@/shared/config/env';
import { api } from '@/shared/api';
import { newClientMessageId } from './clientMessageId';

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    const [client] = useState(() => {
        if (!WS_URL) {
            console.warn('VITE_WS_URL is not set: realtime chat is disabled.');
            return null;
        }
        return createRealtimeClient({ url: WS_URL, getToken: webAuthStorage.getToken });
    });
    const { value } = useRealtimeController({ client, token, newClientMessageId, api, logger: console });

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

    return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
