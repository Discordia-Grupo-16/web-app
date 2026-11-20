import { useState } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useHeaderHeight } from 'expo-router/react-navigation';
import type { MessageAttachment } from '@discordia/api';
import { useAuth, useChannelMessages } from '@discordia/core';
import { api } from '@/shared/api';
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

  // Pick an image from the gallery and upload it to community.
  // React Native FormData cannot use the web File API, so we post the asset URI directly.
  const handleAttach = async (): Promise<MessageAttachment | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return null;
    const asset = result.assets[0];
    const fileName = asset.uri.split('/').pop() ?? 'image.jpg';
    let type = asset.mimeType ?? '';
    if (!type) {
      const match = /\.(\w+)$/.exec(fileName);
      type = match ? `image/${match[1]}` : 'image/jpeg';
    }
    if (type === 'image/jpg') type = 'image/jpeg';
    const form = new FormData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.append('file', { uri: asset.uri, name: fileName, type } as any);
    const response = await api.post<{ data: MessageAttachment }>('/api/v1/files/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  };

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
          onAttach={handleAttach}
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
