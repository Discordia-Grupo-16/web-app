import { KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useAuth, useChannelMessages } from '@discordia/core';
import { ConnectionBanner } from './ConnectionBanner';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';

interface ChatScreenProps {
  channelId: string;
  channelName: string;
  canSendMessages: boolean;
}

export const ChatScreen = ({ channelId, channelName, canSendMessages }: ChatScreenProps) => {
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const {
    messages, pending, status, maxLength,
    send, retry, discard,
    historyLoaded, historyError, retryHistory,
    hasMore, loadingMore, loadMoreError, loadMore,
    rejected, clearRejected,
  } = useChannelMessages(channelId);

  return (
    <SafeAreaView className="flex-1 bg-[#36393f]" edges={['bottom']}>
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={headerHeight}>
        <ConnectionBanner status={status} />
        <MessageList
          channelName={channelName}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
