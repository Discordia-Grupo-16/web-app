import { useEffect, useMemo, useRef } from 'react';
import { FlatList, View, Text } from 'react-native';
import type { User } from '@discordia/context';
import type { ChatMessage, PendingMessage } from '@discordia/realtime';
import { displayName } from '../authorName';
import { ERROR_TEXTS } from '../errorMessages';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  channelName: string;
  messages: ChatMessage[];
  pending: PendingMessage[];
  currentUser: User | null;
}

type ListItem =
  | { kind: 'pending'; message: PendingMessage }
  | { kind: 'confirmed'; message: ChatMessage };

export const MessageList = ({ channelName, messages, pending, currentUser }: MessageListProps) => {
  const listRef = useRef<FlatList<ListItem>>(null);
  const pendingCountRef = useRef(pending.length);

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
      renderItem={({ item }) =>
        item.kind === 'confirmed' ? (
          <MessageItem
            authorId={item.message.authorId}
            authorName={displayName(item.message.authorId, currentUser)}
            content={item.message.content}
            createdAt={item.message.createdAt}
          />
        ) : (
          <MessageItem
            authorId={currentUser?.id ?? ''}
            authorName={currentUser?.name || 'Vos'}
            content={item.message.content}
            sending={item.message.status === 'sending'}
            failed={item.message.status === 'failed'}
            errorText={item.message.errorCode && ERROR_TEXTS[item.message.errorCode]}
          />
        )
      }
    />
  );
};
