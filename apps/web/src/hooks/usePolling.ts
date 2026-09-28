import { useEffect, useRef } from 'react';

// Chat doesn't push server or channel changes over the socket, so views that list them poll
// while the tab is visible, and once more when the tab becomes visible again.
export const POLL_INTERVAL_MS = 5000;

export const usePolling = (tick: () => void, enabled = true) => {
    const tickRef = useRef(tick);
    useEffect(() => {
        tickRef.current = tick;
    });

    useEffect(() => {
        if (!enabled) return;
        const run = () => {
            if (document.visibilityState === 'visible') tickRef.current();
        };
        const interval = window.setInterval(run, POLL_INTERVAL_MS);
        document.addEventListener('visibilitychange', run);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', run);
        };
    }, [enabled]);
};

// 404: the server was deleted. 403: we are no longer a member.
export const isGoneError = (err: unknown): boolean => {
    const status = (err as { response?: { status?: number } })?.response?.status;
    return status === 404 || status === 403;
};
