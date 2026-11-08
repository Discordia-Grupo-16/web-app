import { createContext } from 'react';
import type { UnreadState } from './unreadStore';

export interface UnreadContextValue {
    state: UnreadState;
    /**
     * Tells the controller which channel the user is looking at and whether it can actually be
     * seen. Opening a channel with news, or coming back to it, reports it as read up to its last
     * message; while it stays open and visible, new messages are reported in groups.
     * `setActiveChannel(null, false)` when no channel is open.
     */
    setActiveChannel: (channelId: string | null, visible: boolean) => void;
    /** Marks everything as read. Rejects if the request fails: the caller decides what to show. */
    markAllRead: () => Promise<void>;
}

export const UnreadContext = createContext<UnreadContextValue | null>(null);
