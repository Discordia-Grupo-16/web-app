import { useCallback, useMemo } from 'react';
import type { ChatMessage, PendingMessage } from './chatStore';
import type { RealtimeStatus } from './realtimeContext';
import { useRealtime } from './useRealtime';

export interface ChannelMessages {
    messages: ChatMessage[];
    pending: PendingMessage[];
    status: RealtimeStatus;
    maxLength: number;
    send: (content: string) => void;
    retry: (clientMessageId: string) => void;
    discard: (clientMessageId: string) => void;
}

const NO_MESSAGES: ChatMessage[] = [];

export const useChannelMessages = (channelId: string): ChannelMessages => {
    const { state, status, maxLength, send, retry, discard } = useRealtime();

    const messages = state.byChannel[channelId] ?? NO_MESSAGES;
    const pending = useMemo(
        () =>
            state.pendingOrder
                .map((id) => state.pending[id])
                .filter((message): message is PendingMessage => message !== undefined && message.channelId === channelId),
        [state.pendingOrder, state.pending, channelId],
    );

    const sendToChannel = useCallback((content: string) => send(channelId, content), [send, channelId]);

    return { messages, pending, status, maxLength, send: sendToChannel, retry, discard };
};
