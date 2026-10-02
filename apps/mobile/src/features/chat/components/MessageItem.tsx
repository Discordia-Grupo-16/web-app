import { View, Text, Pressable, TouchableOpacity } from 'react-native';

interface MessageItemProps {
  authorId: string;
  authorName: string;
  content: string;
  createdAt?: string;
  sending?: boolean;
  failed?: boolean;
  errorText?: string;
  onLongPress?: () => void;
  onRetry?: () => void;
  retryDisabled?: boolean;
  onDiscard?: () => void;
}

const AVATAR_COLORS = ['#7289da', '#43b581', '#faa61a', '#f47fff', '#f04747', '#00b0f4', '#747f8d', '#e67e22'];

const avatarColor = (authorId: string): string => {
  let hash = 0;
  for (const char of authorId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

// Formatted by hand: Intl locale support varies between Hermes builds and would not always give HH:mm.
const formatTime = (createdAt: string): string => {
  const date = new Date(createdAt);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const MessageItem = ({
  authorId,
  authorName,
  content,
  createdAt,
  sending = false,
  failed = false,
  errorText,
  onLongPress,
  onRetry,
  retryDisabled = false,
  onDiscard,
}: MessageItemProps) => (
  <Pressable
    className="flex-row px-4 py-1"
    style={{
      opacity: sending ? 0.5 : 1,
      borderLeftWidth: 2,
      borderLeftColor: failed ? '#ed4245' : 'transparent',
    }}
    onLongPress={onLongPress}
  >
    <View
      className="w-9 h-9 rounded-full items-center justify-center mr-3"
      style={{ backgroundColor: avatarColor(authorId) }}
    >
      <Text className="text-white font-bold">{(authorName.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
    <View className="flex-1">
      <View className="flex-row items-baseline">
        <Text className="text-white font-bold text-sm mr-2">{authorName}</Text>
        {createdAt && <Text className="text-xs text-[#72767d]">{formatTime(createdAt)}</Text>}
      </View>
      {/* Content comes from other users: always rendered as plain text. Not selectable when failed so the long-press reaches the row. */}
      <Text selectable={!failed} className="text-sm text-[#dcddde]">{content}</Text>
      {failed && (
        <View className="flex-row flex-wrap items-center mt-1">
          {errorText && <Text className="text-xs mr-3 text-[#ed4245]">{errorText}</Text>}
          {onRetry && (
            <TouchableOpacity className="mr-3 py-1" onPress={onRetry} disabled={retryDisabled} style={{ opacity: retryDisabled ? 0.4 : 1 }}>
              <Text className="text-xs font-semibold underline text-[#ed4245]">Reintentar</Text>
            </TouchableOpacity>
          )}
          {onDiscard && (
            <TouchableOpacity className="py-1" onPress={onDiscard}>
              <Text className="text-xs font-semibold underline text-[#ed4245]">Descartar</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  </Pressable>
);
