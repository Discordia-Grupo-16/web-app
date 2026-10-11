import { useCallback, useEffect, useMemo } from 'react';
import type { ChatMessage, PendingMessage } from './chatStore';
import type { RealtimeStatus, RejectedMessage } from './realtimeContext';
import { useRealtime } from './useRealtime';

export interface ChannelMessages {
    messages: ChatMessage[];
    pending: PendingMessage[];
    status: RealtimeStatus;
    maxLength: number;
    historyLoaded: boolean;
    historyError: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    loadMoreError: boolean;
    send: (content: string) => void;
    retry: (clientMessageId: string) => void;
    discard: (clientMessageId: string) => void;
    loadMore: () => void;
    retryHistory: () => void;
    rejected: RejectedMessage | null;
    clearRejected: () => void;
}

const NO_MESSAGES: ChatMessage[] = [];

export const useChannelMessages = (channelId: string): ChannelMessages => {
    const { state, status, maxLength, send, retry, discard, lastRejected, clearRejected, loadHistory, retryHistory, loadMoreHistory } =
        useRealtime();

    useEffect(() => {
        loadHistory(channelId);
    }, [channelId, loadHistory]);

    const messages = state.byChannel[channelId] ?? NO_MESSAGES;
    const historyMeta = state.historyByChannel[channelId];
    const historyLoaded = historyMeta?.loaded ?? false;
    const historyError = historyMeta?.error ?? false;
    const hasMore = historyMeta?.hasMore ?? false;
    const loadingMore = historyMeta?.loadingMore ?? false;
    const loadMoreError = historyMeta?.loadMoreError ?? false;

    const pending = useMemo(
        () =>
            state.pendingOrder
                .map((id) => state.pending[id])
                .filter((message): message is PendingMessage => message !== undefined && message.channelId === channelId),
        [state.pendingOrder, state.pending, channelId],
    );

    const sendToChannel = useCallback((content: string) => send(channelId, content), [send, channelId]);

    const loadMore = useCallback(() => {
        const firstMessage = messages[0];
        if (!firstMessage || !hasMore || loadingMore) return;
        loadMoreHistory(channelId, firstMessage.messageId);
    }, [channelId, messages, hasMore, loadingMore, loadMoreHistory]);

    const retryHistoryForChannel = useCallback(() => retryHistory(channelId), [retryHistory, channelId]);

    const rejected = lastRejected && lastRejected.channelId === channelId ? lastRejected : null;

    return {
        messages,
        pending,
        status,
        maxLength,
        historyLoaded,
        historyError,
        hasMore,
        loadingMore,
        loadMoreError,
        send: sendToChannel,
        retry,
        discard,
        loadMore,
        retryHistory: retryHistoryForChannel,
        rejected,
        clearRejected,
    };
};
