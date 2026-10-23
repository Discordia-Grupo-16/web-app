import { useAuth, useChannelMessages } from '@discordia/core';
import { ConnectionBanner } from './ConnectionBanner';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';

interface ChatPanelProps {
    channelId: string;
    channelName: string;
    topic: string | null;
    canSendMessages: boolean;
}

export const ChatPanel = ({ channelId, channelName, topic, canSendMessages }: ChatPanelProps) => {
    const { user } = useAuth();
    const { messages, pending, status, maxLength, send, retry, discard, rejected, clearRejected } =
        useChannelMessages(channelId);

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
            />
            <MessageComposer
                channelName={channelName}
                status={status}
                maxLength={maxLength}
                onSend={send}
                rejected={rejected}
                onRejectedHandled={clearRejected}
                canSendMessages={canSendMessages}
            />
        </div>
    );
};
