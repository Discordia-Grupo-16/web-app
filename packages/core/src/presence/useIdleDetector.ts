import { useContext, useEffect } from 'react';
import { RealtimeContext } from '../chat/realtimeContext';

/** Without interaction for this long, the user is idle (SCRUM-27, CA2). */
export const PRESENCE_IDLE_MINUTES = 5;

// Core compiles without lib DOM because it is shared with React Native, which has no document.
interface ActivitySource {
    addEventListener(type: string, listener: () => void, options?: { capture?: boolean; passive?: boolean }): void;
    removeEventListener(type: string, listener: () => void, options?: { capture?: boolean }): void;
}

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Tells `chat` when the user stops interacting with the page and when they come back. Mount it once,
 * inside the realtime provider. It only watches a document: mobile reports idleness from `AppState`.
 *
 * Each tab reports itself, and the user is idle only if every connection is, so a tab in the
 * background does not hide the activity of another one.
 */
export const useIdleDetector = (idleMinutes: number = PRESENCE_IDLE_MINUTES): void => {
    const sendActivity = useContext(RealtimeContext)?.sendActivity;

    useEffect(() => {
        const page = (globalThis as { document?: ActivitySource }).document;
        if (!page || !sendActivity) return;

        const limit = idleMinutes * 60_000;
        let lastActivity = Date.now();
        let idle = false;
        let timer: ReturnType<typeof setTimeout>;

        // One timer that looks at the last activity when it fires, instead of one restarted on every
        // mouse move.
        const check = () => {
            const remaining = limit - (Date.now() - lastActivity);
            if (remaining > 0) {
                timer = setTimeout(check, remaining);
                return;
            }
            idle = true;
            sendActivity(true);
        };

        const onActivity = () => {
            lastActivity = Date.now();
            if (!idle) return;
            idle = false;
            sendActivity(false);
            timer = setTimeout(check, limit);
        };

        // Capture: scroll does not bubble.
        for (const type of ACTIVITY_EVENTS) page.addEventListener(type, onActivity, { capture: true, passive: true });
        timer = setTimeout(check, limit);

        return () => {
            clearTimeout(timer);
            for (const type of ACTIVITY_EVENTS) page.removeEventListener(type, onActivity, { capture: true });
            if (idle) sendActivity(false);
        };
    }, [idleMinutes, sendActivity]);
};
