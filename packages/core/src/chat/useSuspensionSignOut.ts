import { useEffect, useRef } from 'react';
import { CLOSE_ACCOUNT_SUSPENDED, type RealtimeClient } from '@discordia/api';
import { useAuth } from '../session/AuthProvider';

/** Same text on web and mobile (parity, DoD 2). */
export const ACCOUNT_SUSPENDED_NOTICE = 'Tu cuenta fue suspendida por el equipo de Discordia.';

/**
 * chat closes the socket with 4403 when the staff suspends the account (contract D4).
 * The realtime client already stopped reconnecting; here the app drops the session and lets
 * its own login screen explain why. Each app decides where the notice survives the redirect.
 */
export function useSuspensionSignOut(client: RealtimeClient | null, onSuspended: () => void): void {
    const { signOut } = useAuth();

    // Both callbacks change identity on every render. Keeping them in refs (updated in an
    // effect, not during render) avoids re-subscribing to the client each time.
    const signOutRef = useRef(signOut);
    const onSuspendedRef = useRef(onSuspended);

    useEffect(() => {
        signOutRef.current = signOut;
        onSuspendedRef.current = onSuspended;
    }, [signOut, onSuspended]);

    useEffect(() => {
        if (!client) return;
        return client.on('terminated', ({ code }) => {
            if (code !== CLOSE_ACCOUNT_SUSPENDED) return;
            onSuspendedRef.current();
            void signOutRef.current();
        });
    }, [client]);
}
