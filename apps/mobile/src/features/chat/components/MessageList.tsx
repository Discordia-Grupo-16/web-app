import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { User } from '@discordia/api';
import type { ChatMessage, PendingMessage } from '@discordia/core';
import { authorView, ERROR_TEXTS, isRetryable, usePublicProfiles } from '@discordia/core';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  channelName: string;
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
  /** The user can still write in the channel (SEND_MESSAGES): without it their messages cannot be edited. */
  canEditOwn: boolean;
  /** The user chose "Editar" in the menu of one of their own messages. */
  onStartEdit: (messageId: string) => void;
}

// There is no tooltip on mobile: the correlationId (for searching the logs) is shown on long-press.
const showErrorDetails = (errorCode: string | undefined, correlationId: string | undefined) =>
  Alert.alert('Detalle del error', `Código: ${errorCode ?? 'desconocido'}\ncorrelationId: ${correlationId ?? 'sin dato'}`);

// The long-press menu of an own message. "Editar" is the only action for now.
const showMessageMenu = (onEdit: () => void) =>
  Alert.alert('Mensaje', undefined, [
    { text: 'Editar', onPress: onEdit },
    { text: 'Cancelar', style: 'cancel' },
  ]);

type ListItem =
  | { kind: 'pending'; message: PendingMessage }
  | { kind: 'confirmed'; message: ChatMessage };

export const MessageList = ({
  channelName,
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
  canEditOwn,
  onStartEdit,
}: MessageListProps) => {
  const listRef = useRef<FlatList<ListItem>>(null);
  const pendingCountRef = useRef(pending.length);
  const router = useRouter();

  // Own messages come from the session, so only the other authors need their public profile.
  const authorIds = useMemo(
    () => [...new Set(messages.map((message) => message.authorId))].filter((id) => id !== currentUser?.id),
    [messages, currentUser?.id],
  );
  const profiles = usePublicProfiles(authorIds);

  // Inverted list: index 0 is the bottom, so newest first and pending ones (always newer) before confirmed.
  const data = useMemo<ListItem[]>(
    () => [
      ...[...pending].reverse().map((message): ListItem => ({ kind: 'pending', message })),
      ...[...messages].reverse().map((message): ListItem => ({ kind: 'confirmed', message })),
    ],
    [messages, pending],
  );

  // A new pending message is our own send: always follow it, even if the user had scrolled up.
  useEffect(() => {
    if (pending.length > pendingCountRef.current) listRef.current?.scrollToOffset({ offset: 0, animated: true });
    pendingCountRef.current = pending.length;
  }, [pending.length]);

  if (!historyLoaded && !historyError) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#7289da" />
      </View>
    );
  }

  if (historyError) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-sm text-[#99aab5]">No se pudo cargar el historial.</Text>
        <Text className="mt-2 text-sm text-[#7289da]" onPress={onRetryHistory}>
          Reintentar
        </Text>
      </View>
    );
  }

  // Rendered outside the FlatList: ListEmptyComponent would come out upside down in an inverted list.
  if (data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-semibold text-[#99aab5]">Bienvenido a #{channelName}</Text>
        <Text className="text-sm mt-3 text-center text-[#99aab5]">
          Los mensajes que se envíen mientras estés conectado van a aparecer acá.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      className="flex-1"
      inverted
      data={data}
      // clientMessageId is unique per channel and keeps the row mounted when a pending message is confirmed.
      keyExtractor={(item) => item.message.clientMessageId}
      keyboardShouldPersistTaps="handled"
      // In an inverted list, onEndReached fires when scrolling to the visual top (oldest messages).
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.2}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator size="small" color="#7289da" style={{ paddingVertical: 12 }} />
        ) : loadMoreError ? (
          <View className="items-center py-2 gap-1">
            <Text className="text-xs text-center text-[#ed4245]">No se pudo cargar más mensajes.</Text>
            <Text className="text-xs text-[#7289da]" onPress={onRetryLoadMore}>Reintentar</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        if (item.kind === 'confirmed') {
          const { authorId } = item.message;
          const author = authorView(authorId, currentUser, profiles.get(authorId));
          // Read from the props on every render, never kept: if SEND_MESSAGES is taken away with the
          // screen open the menu stops existing on the next render.
          const canEdit = canEditOwn && currentUser !== null && authorId === currentUser.id;
          return (
            <MessageItem
              authorId={authorId}
              authorName={author.name}
              authorAvatarUrl={author.avatarUrl}
              content={item.message.content}
              createdAt={item.message.createdAt}
              editedAt={item.message.editedAt}
              onLongPress={canEdit ? () => showMessageMenu(() => onStartEdit(item.message.messageId)) : undefined}
              onSelectAuthor={() => router.push({ pathname: '/user/[userId]', params: { userId: authorId } })}
            />
          );
        }
        return (
          <MessageItem
            authorId={currentUser?.id ?? ''}
            authorName={currentUser?.name || 'Vos'}
            authorAvatarUrl={currentUser?.avatarUrl ?? null}
            content={item.message.content}
            sending={item.message.status === 'sending'}
            failed={item.message.status === 'failed'}
            errorText={item.message.errorCode && ERROR_TEXTS[item.message.errorCode]}
            onLongPress={
              item.message.status === 'failed'
                ? () => showErrorDetails(item.message.errorCode, item.message.correlationId)
                : undefined
            }
            onRetry={isRetryable(item.message.errorCode) ? () => onRetry(item.message.clientMessageId) : undefined}
            retryDisabled={!canRetry}
            onDiscard={() => onDiscard(item.message.clientMessageId)}
          />
        );
      }}
    />
  );
};
