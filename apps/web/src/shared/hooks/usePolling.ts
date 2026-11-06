import { useEffect, useRef } from 'react';

// The default is the old polling for views that nothing pushes. Views that get realtime notices
// (see useLiveRefresh) keep it as a slow safety net instead.
export const POLL_INTERVAL_MS = 5000;

// Polls while the tab is visible, and once more when the tab becomes visible again.
export const usePolling = (tick: () => void, enabled = true, intervalMs = POLL_INTERVAL_MS) => {
    const tickRef = useRef(tick);
    useEffect(() => {
        tickRef.current = tick;
    });

    useEffect(() => {
        if (!enabled) return;
        const run = () => {
            if (document.visibilityState === 'visible') tickRef.current();
        };
        const interval = window.setInterval(run, intervalMs);
        document.addEventListener('visibilitychange', run);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', run);
        };
    }, [enabled, intervalMs]);
};
