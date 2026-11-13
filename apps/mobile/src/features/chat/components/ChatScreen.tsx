import { useState } from 'react';
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
  /** MANAGE_MESSAGES, resolved by `community`. The backend checks it too: this only shows the option. */
  canManageMessages: boolean;
}

export const ChatScreen = ({ channelId, channelName, canSendMessages, canManageMessages }: ChatScreenProps) => {
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const {
    messages, pending, status, maxLength,
    send, retry, discard, editMessage, deleteMessage,
    historyLoaded, historyError, retryHistory,
    hasMore, loadingMore, loadMoreError, loadMore,
    rejected, clearRejected,
  } = useChannelMessages(channelId);
  const [editingId, setEditingId] = useState<string | null>(null);

  // What is being edited is looked up on every render and never kept: the message has to still be in
  // the list, be the user's, and the user has to still be able to write. If SEND_MESSAGES is taken
  // away with the editor open, it closes. Set while rendering (not in an effect) to avoid an extra render.
  const editingMessage = editingId === null ? undefined : messages.find((m) => m.messageId === editingId);
  const canEdit = canSendMessages && editingMessage !== undefined && editingMessage.authorId === user?.id;
  if (editingId !== null && !canEdit) setEditingId(null);

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
          canEditOwn={canSendMessages}
          onStartEdit={setEditingId}
          canManageMessages={canManageMessages}
          onDelete={deleteMessage}
        />
        <MessageComposer
          // Keyed by the message: starting or leaving an edit gives the composer a fresh state.
          key={canEdit ? editingId : 'compose'}
          channelName={channelName}
          status={status}
          maxLength={maxLength}
          onSend={send}
          rejected={rejected}
          onRejectedHandled={clearRejected}
          canSendMessages={canSendMessages}
          editing={
            canEdit && editingMessage
              ? {
                  initialContent: editingMessage.content,
                  onSave: async (content) => {
                    await editMessage(editingMessage.messageId, content);
                    setEditingId(null);
                  },
                  onCancel: () => setEditingId(null),
                }
              : undefined
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
