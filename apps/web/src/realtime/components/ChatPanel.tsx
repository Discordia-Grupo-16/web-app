import { useAuth } from '@discordia/context';
import { useChannelMessages } from '../useChannelMessages';
import { ConnectionBanner } from './ConnectionBanner';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';

interface ChatPanelProps {
    channelId: string;
    channelName: string;
    topic: string | null;
}

export const ChatPanel = ({ channelId, channelName, topic }: ChatPanelProps) => {
    const { user } = useAuth();
    const { messages, pending, status, maxLength, send, retry, discard, rejected, clearRejected } =
        useChannelMessages(channelId);

    // key={channelId} resets scroll position and the unsent draft when switching channels.
    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <ConnectionBanner status={status} />
            <MessageList
                key={channelId}
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
                key={channelId}
                channelName={channelName}
                status={status}
                maxLength={maxLength}
                onSend={send}
                rejected={rejected}
                onRejectedHandled={clearRejected}
            />
        </div>
    );
};
