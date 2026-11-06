import { createContext } from 'react';
import type { ChatState } from './chatStore';
import type {
    ConnectionState,
    InvalidateFrame,
    MessageCreatedFrame,
    ReadStateUpdatedFrame,
} from '@discordia/api';

export type RealtimeStatus = ConnectionState | 'disabled';

export interface RejectedMessage {
    channelId: string;
    content: string;
    code: 'EMPTY_MESSAGE' | 'MESSAGE_TOO_LONG';
    message: string;
}

export interface RealtimeContextValue {
    status: RealtimeStatus;
    state: ChatState;
    maxLength: number;
    send: (channelId: string, content: string) => void;
    retry: (clientMessageId: string) => void;
    discard: (clientMessageId: string) => void;
    lastRejected: RejectedMessage | null;
    clearRejected: () => void;
    loadHistory: (channelId: string) => void;
    retryHistory: (channelId: string) => void;
    loadMoreHistory: (channelId: string, beforeId: string) => void;
    /**
     * Subscribes to the notices that something the client has loaded went stale (ADR-0017). Hooks
     * go through here so none of them touches the RealtimeClient. Returns the unsubscribe function.
     */
    onInvalidate: (handler: (frame: InvalidateFrame) => void) => () => void;
    /**
     * Subscribes to the messages other sessions and users send, for what is not the message list
     * itself (the unread indicators). Returns the unsubscribe function.
     */
    onMessageCreated: (handler: (frame: MessageCreatedFrame) => void) => () => void;
    /**
     * Subscribes to the user's reads made in another session. Returns the unsubscribe function.
     */
    onReadStateUpdated: (handler: (frame: ReadStateUpdatedFrame) => void) => () => void;
    /**
     * Subscribes to the socket coming back after it had been open before: a reconnection, or the
     * app returning from the background. Notices that went by in the meantime are lost (the bus has
     * no replay), so whoever listens refetches everything it has loaded. It does not fire on the
     * first open. Returns the unsubscribe function.
     */
    onReconnect: (handler: () => void) => () => void;
}

export const DEFAULT_MAX_LENGTH = 2000;

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);
