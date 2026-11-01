import { useServerEvents, usePollIntervalMs } from '@discordia/core';
import { usePolling } from './usePolling';

interface LiveRefreshOptions {
    /** The resources this view has loaded; the server's notices about them trigger a refetch. */
    resources: readonly string[];
    /** When set, notices about another server are ignored. */
    serverId?: string;
    /** Asks the API again and updates the state. */
    refresh: () => void;
    enabled?: boolean;
}

// Keeps a view fresh: the server tells it when something went stale (ADR-0017), and a slow poll
// covers a notice that was lost. Coming back to the tab also refetches, which is what the poll
// already did. Without realtime it polls every 5 seconds, as before.
export const useLiveRefresh = ({ resources, serverId, refresh, enabled = true }: LiveRefreshOptions) => {
    const pollIntervalMs = usePollIntervalMs();
    useServerEvents({ resources, serverId, onInvalidate: refresh, enabled });
    usePolling(refresh, enabled, pollIntervalMs);
};
