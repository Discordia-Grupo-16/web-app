import { useContext, useEffect, useRef } from 'react';
import { RealtimeContext } from './realtimeContext';

/** Notices that arrive within this window become a single refetch. */
export const NOTICE_COALESCE_MS = 300;

/**
 * Upper bound of the random delay added before the refetch. Without it, a change in a large server
 * makes all its members ask for the same thing at the same instant.
 */
export const NOTICE_MAX_JITTER_MS = 1000;

/**
 * How long to wait before a refetch triggered by a notice or a reconnection: the coalescing window
 * plus a random part. Shared so every refetch of this kind spreads out the same way.
 */
export const noticeDelayMs = (random: () => number = Math.random): number =>
    NOTICE_COALESCE_MS + random() * NOTICE_MAX_JITTER_MS;

/** The polling that stays as a safety net: it covers a notice that was lost and events that do not exist yet. */
export const BACKUP_POLL_INTERVAL_MS = 60_000;

/** Without realtime there is nothing to push the changes, so the old polling comes back. */
export const FALLBACK_POLL_INTERVAL_MS = 5_000;

export interface UseServerEventsOptions {
    /** The resources this component has loaded; a notice for any other is ignored. */
    resources: readonly string[];
    /** When set, a notice about another server is ignored. A notice without `serverId` still counts. */
    serverId?: string;
    /** The same function the polling used to call: it asks the API again and updates the state. */
    onInvalidate: () => void;
    enabled?: boolean;
    /** Injectable so the jitter can be tested. Default: Math.random. */
    random?: () => number;
}

/**
 * Calls `onInvalidate` when the server says something this component has loaded went stale
 * (ADR-0017), and after the socket comes back, since the notices that went by meanwhile are lost.
 *
 * Several notices become one call, and the call goes out after a random delay. It does not poll:
 * the platform's polling hook is the safety net, see `usePollIntervalMs`.
 *
 * Without a realtime provider it does nothing, like with realtime disabled.
 */
export const useServerEvents = ({
    resources,
    serverId,
    onInvalidate,
    enabled = true,
    random = Math.random,
}: UseServerEventsOptions): void => {
    const realtime = useContext(RealtimeContext);
    const subscribeNotices = realtime?.onInvalidate;
    const subscribeReconnects = realtime?.onReconnect;

    const callbackRef = useRef(onInvalidate);
    const randomRef = useRef(random);
    useEffect(() => {
        callbackRef.current = onInvalidate;
        randomRef.current = random;
    });

    // An inline array would change on every render and resubscribe each time.
    const resourcesKey = resources.join(',');

    useEffect(() => {
        if (!enabled || !subscribeNotices || !subscribeReconnects) return;

        const wanted = new Set(resourcesKey ? resourcesKey.split(',') : []);
        let timer: ReturnType<typeof setTimeout> | null = null;

        // A notice while one is already waiting is absorbed: that refetch has not gone out yet, so
        // it will see the change too.
        const schedule = () => {
            if (timer !== null) return;
            timer = setTimeout(() => {
                timer = null;
                callbackRef.current();
            }, noticeDelayMs(randomRef.current));
        };

        const offNotices = subscribeNotices((frame) => {
            if (serverId && frame.serverId && frame.serverId !== serverId) return;
            if (frame.resources.some((resource) => wanted.has(resource))) schedule();
        });
        const offReconnects = subscribeReconnects(schedule);

        return () => {
            offNotices();
            offReconnects();
            if (timer !== null) clearTimeout(timer);
        };
    }, [enabled, resourcesKey, serverId, subscribeNotices, subscribeReconnects]);
};

/**
 * How often the platform's polling hook should run alongside `useServerEvents`: the slow backup
 * when realtime pushes the changes, the old 5 seconds when it does not.
 */
export const usePollIntervalMs = (): number => {
    const realtime = useContext(RealtimeContext);
    return !realtime || realtime.status === 'disabled' ? FALLBACK_POLL_INTERVAL_MS : BACKUP_POLL_INTERVAL_MS;
};
