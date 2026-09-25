import { useEffect, useRef } from 'react';
import { Hash } from 'lucide-react';
import type { User } from '@discordia/context';
import type { ChatMessage, PendingMessage } from '@discordia/realtime';
import { displayName } from '../authorName';
import { ERROR_TEXTS, isRetryable } from '../errorMessages';
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
}

const STICK_TO_BOTTOM_PX = 100;

export const MessageList = ({
    channelName,
    topic,
    messages,
    pending,
    currentUser,
    canRetry,
    onRetry,
    onDiscard,
}: MessageListProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const nearBottomRef = useRef(true);
    const pendingCountRef = useRef(pending.length);

    const handleScroll = () => {
        const el = containerRef.current;
        if (!el) return;
        nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_TO_BOTTOM_PX;
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        // A new pending message is our own send: always follow it. Incoming ones only if the user was at the bottom.
        const ownSend = pending.length > pendingCountRef.current;
        pendingCountRef.current = pending.length;
        if (ownSend || nearBottomRef.current) el.scrollTop = el.scrollHeight;
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
                <>
                    {messages.map((message) => (
                        <MessageItem
                            key={message.messageId}
                            authorId={message.authorId}
                            authorName={displayName(message.authorId, currentUser)}
                            content={message.content}
                            createdAt={message.createdAt}
                        />
                    ))}
                    {pending.map((message) => (
                        <MessageItem
                            key={message.clientMessageId}
                            authorId={currentUser?.id ?? ''}
                            authorName={currentUser?.name || 'Vos'}
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
