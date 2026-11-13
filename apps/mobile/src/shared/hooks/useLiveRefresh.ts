import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useServerEvents, usePollIntervalMs } from '@discordia/core';
import { useFocusedPolling } from './useFocusedPolling';

interface LiveRefreshOptions {
  /** The resources this screen has loaded; the server's notices about them trigger a refetch. */
  resources: readonly string[];
  /** When set, notices about another server are ignored. */
  serverId?: string;
  /** Asks the API again and updates the state. */
  refresh: () => void;
}

// Keeps a screen fresh: the server tells it when something went stale (ADR-0017), and a slow poll
// covers a notice that was lost. Coming back to the screen also refetches, which is what the poll
// already did. Without realtime it polls every 5 seconds, as before.
//
// Only the focused screen listens: the ones stacked underneath stay mounted, and without this a
// single notice would make every screen in the stack ask for the same server.
export const useLiveRefresh = ({ resources, serverId, refresh }: LiveRefreshOptions) => {
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const pollIntervalMs = usePollIntervalMs();
  useServerEvents({ resources, serverId, onInvalidate: refresh, enabled: focused });
  useFocusedPolling(refresh, pollIntervalMs);
};
