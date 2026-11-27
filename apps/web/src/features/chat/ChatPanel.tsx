import { useAuth, useChannelMessages } from '@discordia/core';
import { ConnectionBanner } from './ConnectionBanner';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';

interface ChatPanelProps {
    channelId: string;
    channelName: string;
    topic: string | null;
    canSendMessages: boolean;
    /** Until when a moderator's mute lasts, if it is on: the composer says so (SCRUM-71). */
    mutedUntil?: string | null;
    /** MANAGE_MESSAGES, resolved by `community`. The backend checks it too: this only shows the option. */
    canManageMessages: boolean;
    /** ADD_REACTIONS, resolved by `community`. The backend checks it too: this only shows the option. */
    canAddReactions: boolean;
}

export const ChatPanel = ({
    channelId,
    channelName,
    topic,
    canSendMessages,
    mutedUntil = null,
    canManageMessages,
    canAddReactions,
}: ChatPanelProps) => {
    const { user } = useAuth();
    const {
        messages, pending, status, maxLength,
        send, retry, discard, editMessage, deleteMessage, setReaction,
        historyLoaded, historyError, retryHistory,
        hasMore, loadingMore, loadMoreError, loadMore,
        rejected, clearRejected,
    } = useChannelMessages(channelId);

    // The caller keys this panel by channelId, so switching channels remounts it and resets
    // scroll position and the unsent draft. Keys here would be duplicated between siblings.
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <ConnectionBanner status={status} />
            <MessageList
                channelName={channelName}
                topic={topic}
                messages={messages}
                pending={pending}
                currentUser={user}
                canRetry={status === 'open'}
                onRetry={retry}
                onDiscard={discard}
                historyLoaded={historyLoaded}
                historyError={historyError}
                onRetryHistory={retryHistory}
                hasMore={hasMore}
                loadingMore={loadingMore}
                loadMoreError={loadMoreError}
                onLoadMore={loadMore}
                onRetryLoadMore={loadMore}
                canEditOwn={canSendMessages}
                maxLength={maxLength}
                onEdit={editMessage}
                canManageMessages={canManageMessages}
                onDelete={deleteMessage}
                canAddReactions={canAddReactions}
                onReact={setReaction}
            />
            <MessageComposer
                channelName={channelName}
                status={status}
                maxLength={maxLength}
                onSend={send}
                rejected={rejected}
                onRejectedHandled={clearRejected}
                canSendMessages={canSendMessages}
                mutedUntil={mutedUntil}
            />
        </div>
    );
};
