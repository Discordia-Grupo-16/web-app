import { useCallback, useEffect, useState } from 'react';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';

export type CommonServersState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; servers: Server[] };

interface Loaded {
    userId: string;
    attempt: number;
    state: CommonServersState;
}

// Servers shared with another user (public profile, CA 1). It lives apart from the profile request
// on purpose: community failing must not blank the identity data, and the client combines both.
export const useCommonServers = (userId: string) => {
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<Loaded | null>(null);

    useEffect(() => {
        let active = true;
        serversService
            .getServers({ withUser: userId })
            .then((servers) => {
                if (active) setLoaded({ userId, attempt, state: { status: 'ready', servers } });
            })
            .catch(() => {
                if (active) setLoaded({ userId, attempt, state: { status: 'error' } });
            });
        return () => {
            active = false;
        };
    }, [userId, attempt]);

    const retry = useCallback(() => setAttempt((current) => current + 1), []);
    // A result for another user, or from before a retry, is stale.
    const state: CommonServersState =
        loaded && loaded.userId === userId && loaded.attempt === attempt ? loaded.state : { status: 'loading' };
    return { state, retry };
};
