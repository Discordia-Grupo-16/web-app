import { createContext } from 'react';
import type { ConnectionState } from '@discordia/realtime';
import type { ChatState } from './chatStore';

export type RealtimeStatus = ConnectionState | 'disabled';

export interface RealtimeContextValue {
    status: RealtimeStatus;
    state: ChatState;
    maxLength: number;
    send: (channelId: string, content: string) => void;
    retry: (clientMessageId: string) => void;
    discard: (clientMessageId: string) => void;
}

export const DEFAULT_MAX_LENGTH = 2000;

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);
