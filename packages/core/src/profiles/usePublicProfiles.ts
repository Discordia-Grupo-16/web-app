import { useCallback, useEffect, useState } from 'react';
import type { PublicUser } from '@discordia/api';
import { usePublicProfileSource } from './PublicProfilesProvider';

// undefined: not loaded yet (or the request failed), null: the account is not available.
export type ProfileLookup = ReadonlyMap<string, PublicUser | null>;

// Ids are UUIDs, so a comma-joined key is stable across renders even if the caller builds a new array.
const keyOf = (ids: readonly string[]): string => [...new Set(ids)].sort().join(',');

// Resolves a list of authors for the chat and member lists. A failure is silent on purpose: the
// caller falls back to a generic name, and the next change in the id set asks again.
export const usePublicProfiles = (ids: readonly string[]): ProfileLookup => {
    const source = usePublicProfileSource();
    const key = keyOf(ids);
    const [resolved, setResolved] = useState<ProfileLookup>(new Map());

    useEffect(() => {
        if (!key) return;
        let active = true;
        source
            .getPublicProfiles(key.split(','))
            .then((profiles) => {
                if (active) setResolved((previous) => new Map([...previous, ...profiles]));
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [source, key]);

    return resolved;
};

export type PublicProfileState =
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; profile: PublicUser | null };

export interface PublicProfileResult {
    state: PublicProfileState;
    retry: () => void;
}

// One profile with explicit loading and error states, for the profile view. It always asks the API:
// the chat may show a cached profile, but opening one is an explicit action and must be current.
export const usePublicProfile = (userId: string): PublicProfileResult => {
    const source = usePublicProfileSource();
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState<{ userId: string; attempt: number; state: PublicProfileState } | null>(null);

    useEffect(() => {
        let active = true;
        source
            .getPublicProfiles([userId], { fresh: true })
            .then((profiles) => {
                if (active) setLoaded({ userId, attempt, state: { status: 'ready', profile: profiles.get(userId) ?? null } });
            })
            .catch(() => {
                if (active) setLoaded({ userId, attempt, state: { status: 'error' } });
            });
        return () => {
            active = false;
        };
    }, [source, userId, attempt]);

    const retry = useCallback(() => setAttempt((current) => current + 1), []);
    // A result from another user or from before a retry is stale: show loading until the new one lands.
    const current = loaded && loaded.userId === userId && loaded.attempt === attempt ? loaded.state : null;
    return { state: current ?? { status: 'loading' }, retry };
};
