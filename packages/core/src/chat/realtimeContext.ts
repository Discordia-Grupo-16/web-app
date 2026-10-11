import { createContext } from 'react';
import type { ChatState } from './chatStore';
import type { ConnectionState } from '@discordia/api';

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
}

export const DEFAULT_MAX_LENGTH = 2000;

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);
