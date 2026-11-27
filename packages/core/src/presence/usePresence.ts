import { useContext, useEffect, useRef, useState } from 'react';
import type { MemberPresence, PresenceStatus } from '@discordia/api';
import { RealtimeContext } from '../chat/realtimeContext';
import { useServerEvents } from '../chat/useServerEvents';

/** Status by user id. A user who is not in the map is offline. */
export type PresenceMap = ReadonlyMap<string, PresenceStatus>;

/** `getServerPresence` of the presence service: the app hands it over, core does not own HTTP. */
export type PresenceSource = (serverId: string) => Promise<MemberPresence[]>;

interface Entry {
    status: PresenceStatus;
    /** `updatedAt` as an instant. */
    at: number;
    /** When (on the hook's `clock`) a frame last set it, to compare with a snapshot request. */
    touched: number;
}

// Core compiles without lib DOM because it is shared with React Native, which has no document.
interface PageVisibility {
    readonly visibilityState: string;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

const MEMBER_RESOURCES = ['members'] as const;

/**
 * The activity status of the members of a server (SCRUM-27).
 *
 * Asks for the snapshot on mount, when the socket comes back (the frames that went by are lost; with
 * the same random delay as `useServerEvents`), when the tab becomes visible and when the members
 * change: someone who joins while already online publishes nothing. In between, `presence` frames
 * replace one user's status. A state is applied only if its `updatedAt` is newer than the one held,
 * compared as an instant.
 *
 * Returns null until the first snapshot arrives: until then nobody is known to be offline. A failed
 * snapshot is silent, the next one asks again.
 */
export const usePresence = (
    serverId: string | undefined,
    getSnapshot: PresenceSource,
    /** Injectable so the jitter can be tested. Default: Math.random. */
    random: () => number = Math.random,
): PresenceMap | null => {
    const realtime = useContext(RealtimeContext);
    const subscribeFrames = realtime?.onPresence;

    // Tagged with its server: when serverId changes, the old map is no longer shown.
    const [held, setHeld] = useState<{ serverId: string; statuses: PresenceMap } | null>(null);

    const refreshRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        if (!serverId) return;
        let active = true;

        // Per effect run, so each server starts from nothing.
        const entries = new Map<string, Entry>();
        let clock = 0;
        let lastAppliedRequest = 0;
        let loaded = false;

        const publish = () => {
            if (!loaded) return;
            const statuses = new Map<string, PresenceStatus>();
            for (const [userId, entry] of entries) {
                if (entry.status !== 'offline') statuses.set(userId, entry.status);
            }
            setHeld({ serverId, statuses });
        };

        const refresh = () => {
            const request = ++clock;
            getSnapshot(serverId)
                .then((members) => {
                    // A snapshot that started before one already applied is older as a whole.
                    if (!active || request < lastAppliedRequest) return;
                    lastAppliedRequest = request;
                    loaded = true;
                    const present = new Set<string>();
                    for (const member of members) {
                        present.add(member.userId);
                        const at = Date.parse(member.updatedAt);
                        if (Number.isNaN(at)) continue;
                        const known = entries.get(member.userId);
                        // At the same instant the snapshot wins unless a frame came after the request.
                        if (known && (at < known.at || (at === known.at && known.touched > request))) continue;
                        entries.set(member.userId, { status: member.status, at, touched: known?.touched ?? 0 });
                    }
                    // Who is missing is offline, unless a frame landed after the request left. The
                    // instant stays, so a late old frame cannot bring them back.
                    for (const [userId, entry] of entries) {
                        if (!present.has(userId) && entry.touched <= request) {
                            entries.set(userId, { ...entry, status: 'offline' });
                        }
                    }
                    publish();
                })
                .catch(() => undefined);
        };
        refreshRef.current = refresh;

        const offFrames = subscribeFrames?.((frame) => {
            const at = Date.parse(frame.updatedAt);
            if (Number.isNaN(at)) return;
            const known = entries.get(frame.userId);
            if (known && at <= known.at) return;
            entries.set(frame.userId, { status: frame.status, at, touched: ++clock });
            publish();
        });

        // Mobile has no document: there the app coming back goes through the reconnection.
        const page = (globalThis as { document?: PageVisibility }).document;
        const onVisibility = () => {
            if (page?.visibilityState === 'visible') refresh();
        };
        page?.addEventListener('visibilitychange', onVisibility);

        refresh();

        return () => {
            active = false;
            refreshRef.current = () => undefined;
            offFrames?.();
            page?.removeEventListener('visibilitychange', onVisibility);
        };
    }, [serverId, getSnapshot, subscribeFrames]);

    // Asks again after a reconnection and when the members change, spread out like every refetch.
    useServerEvents({
        resources: MEMBER_RESOURCES,
        serverId,
        onInvalidate: () => refreshRef.current(),
        enabled: !!serverId,
        random,
    });

    return held && held.serverId === serverId ? held.statuses : null;
};
