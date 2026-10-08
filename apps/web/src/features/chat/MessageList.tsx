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
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
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
    hasMore,
    loadingMore,
    onLoadMore,
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

    const prevScrollHeightRef = useRef(0);
    const prevMessageCountRef = useRef(messages.length);

    const handleScroll = () => {
        const el = containerRef.current;
        if (!el) return;
        nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
        if (hasMore && !loadingMore && el.scrollTop < LOAD_MORE_THRESHOLD_PX) {
            onLoadMore();
        }
    };

    // Capture scrollHeight before React commits the render that prepends older messages.
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        if (messages.length > prevMessageCountRef.current && !nearBottomRef.current) {
            prevScrollHeightRef.current = el.scrollHeight;
        } else {
            prevScrollHeightRef.current = 0;
        }
        prevMessageCountRef.current = messages.length;
    }, [messages.length]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ownSend = pending.length > pendingCountRef.current;
        pendingCountRef.current = pending.length;
        if (prevScrollHeightRef.current > 0) {
            // Restore scroll position so prepending older messages doesn't jump the user to the top.
            el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
            prevScrollHeightRef.current = 0;
        } else if (ownSend || nearBottomRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages.length, pending.length]);

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
                <>{loadingMore && (
                        <div className="flex justify-center py-3">
                            <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7289da', borderTopColor: 'transparent' }} />
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
