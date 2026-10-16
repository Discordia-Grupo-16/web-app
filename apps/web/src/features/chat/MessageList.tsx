import { useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { Hash } from 'lucide-react';
import type { User } from '@discordia/api';
import type { ChatMessage, PendingMessage } from '@discordia/core';
import { authorView, ERROR_TEXTS, isRetryable, usePublicProfiles } from '@discordia/core';
import { useProfileViewer } from '@/shared/profile/ProfileViewerContext';
import { MessageItem } from './MessageItem';

interface MessageListProps {
    channelName: string;
    topic: string | null;
    messages: ChatMessage[];
    pending: PendingMessage[];
    currentUser: User | null;
    canRetry: boolean;
    onRetry: (clientMessageId: string) => void;
    onDiscard: (clientMessageId: string) => void;
    historyLoaded: boolean;
    historyError: boolean;
    onRetryHistory: () => void;
    hasMore: boolean;
    loadingMore: boolean;
    loadMoreError: boolean;
    onLoadMore: () => void;
    onRetryLoadMore: () => void;
}

const STICK_TO_BOTTOM_PX = 100;
const LOAD_MORE_THRESHOLD_PX = 80;

export const MessageList = ({
    channelName,
    topic,
    messages,
    pending,
    currentUser,
    canRetry,
    onRetry,
    onDiscard,
    historyLoaded,
    historyError,
    onRetryHistory,
    hasMore,
    loadingMore,
    loadMoreError,
    onLoadMore,
    onRetryLoadMore,
}: MessageListProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const nearBottomRef = useRef(true);
    const pendingCountRef = useRef(pending.length);
    const { openProfile } = useProfileViewer();

    // Own messages come from the session, so only the other authors need their public profile.
    const authorIds = useMemo(
        () => [...new Set(messages.map((message) => message.authorId))].filter((id) => id !== currentUser?.id),
        [messages, currentUser?.id],
    );
    const profiles = usePublicProfiles(authorIds);

    // Saved BEFORE calling onLoadMore so the post-update height delta is correct.
    const prevScrollHeightRef = useRef(0);

    const handleScroll = () => {
        const el = containerRef.current;
        if (!el) return;
        nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
        if (hasMore && !loadingMore && el.scrollTop < LOAD_MORE_THRESHOLD_PX) {
            prevScrollHeightRef.current = el.scrollHeight;
            onLoadMore();
        }
    };

    // Apply scroll restoration synchronously before paint (prevents Safari jump when prepending).
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el || prevScrollHeightRef.current === 0) return;
        el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
        prevScrollHeightRef.current = 0;
    }, [messages.length]);

    // When loadMore finishes without new messages (error or empty page), clear the saved height so
    // the next unrelated messages.length change doesn't apply a stale scroll adjustment.
    useLayoutEffect(() => {
        if (!loadingMore) prevScrollHeightRef.current = 0;
    }, [loadingMore]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ownSend = pending.length > pendingCountRef.current;
        pendingCountRef.current = pending.length;
        if (ownSend || nearBottomRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages.length, pending.length]);

    if (!historyLoaded && !historyError) {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center" style={{ color: '#99aab5' }}>
                <div className="w-6 h-6 border-2 border-blurple border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (historyError) {
        return (
            <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center" style={{ color: '#99aab5' }}>
                <div className="text-center select-none">
                    <p className="text-sm">No se pudo cargar el historial.</p>
                    <button onClick={onRetryHistory} className="mt-2 text-sm text-blurple hover:underline">
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    const isEmpty = messages.length === 0 && pending.length === 0;

    return (
        <div ref={containerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto py-2">
            {isEmpty ? (
                <div className="h-full flex items-center justify-center" style={{ color: '#99aab5' }}>
                    <div className="text-center select-none">
                        <Hash size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-semibold">Bienvenido a #{channelName}</p>
                        {topic && <p className="text-sm mt-1">{topic}</p>}
                        <p className="text-sm mt-3">
                            Los mensajes que se envíen mientras estés conectado van a aparecer acá.
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {loadingMore && (
                        <div className="flex justify-center py-3">
                            <div className="w-5 h-5 border-2 border-blurple border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    {loadMoreError && (
                        <div className="flex flex-col items-center py-2 text-xs gap-1">
                            <span style={{ color: '#ed4245' }}>No se pudo cargar más mensajes.</span>
                            <button onClick={onRetryLoadMore} className="text-blurple hover:underline">
                                Reintentar
                            </button>
                        </div>
                    )}
                    {messages.map((message) => {
                        const author = authorView(message.authorId, currentUser, profiles.get(message.authorId));
                        return (
                            <MessageItem
                                key={message.messageId}
                                authorId={message.authorId}
                                authorName={author.name}
                                authorAvatarUrl={author.avatarUrl}
                                content={message.content}
                                createdAt={message.createdAt}
                                onSelectAuthor={() => openProfile(message.authorId)}
                            />
                        );
                    })}
                    {pending.map((message) => (
                        <MessageItem
                            key={message.clientMessageId}
                            authorId={currentUser?.id ?? ''}
                            authorName={currentUser?.name || 'Vos'}
                            authorAvatarUrl={currentUser?.avatarUrl ?? null}
                            content={message.content}
                            sending={message.status === 'sending'}
                            failed={message.status === 'failed'}
                            errorText={message.errorCode && ERROR_TEXTS[message.errorCode]}
                            errorTitle={message.correlationId && `correlationId: ${message.correlationId}`}
                            onRetry={isRetryable(message.errorCode) ? () => onRetry(message.clientMessageId) : undefined}
                            retryDisabled={!canRetry}
                            onDiscard={() => onDiscard(message.clientMessageId)}
                        />
                    ))}
                </>
            )}
        </div>
    );
};
