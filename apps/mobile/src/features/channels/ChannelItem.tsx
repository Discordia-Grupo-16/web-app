import { Text, TouchableOpacity, View } from 'react-native';
import type { Channel } from '@discordia/api';
import { useChannelUnread } from '@discordia/core';
import { UnreadMarks } from '@/shared/ui/UnreadMarks';

export function ChannelItem({ channel, canManage, onDelete, onEdit, onOpen }: {
  channel: Channel; canManage: boolean;
  onDelete: (ch: Channel) => void; onEdit: (ch: Channel) => void; onOpen?: (ch: Channel) => void;
}) {
  const { unread, mentionCount } = useChannelUnread(channel.id);
  const prefix = channel.type === 'text' ? '#' : '🔊';
  const content = (
    <>
      <Text className={`text-sm flex-1 ${unread ? 'text-white font-bold' : 'text-[#dcddde]'}`}>
        {prefix} {channel.name}
      </Text>
      {unread && <UnreadMarks mentionCount={mentionCount} what={`el canal ${channel.name}`} />}
      {canManage && (
        <View className="flex-row gap-2 ml-3">
          <TouchableOpacity onPress={() => onEdit(channel)} className="p-1">
            <Text className="text-[#72767d] text-base">✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(channel)} className="p-1">
            <Text className="text-[#72767d] text-base">🗑</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
  const rowClass = 'bg-[#2c2f33] rounded-lg px-4 py-3 flex-row items-center justify-between';

  // Only channels with an onOpen handler are tappable; the delete button keeps its own onPress.
  if (!onOpen) return <View className={rowClass}>{content}</View>;
  return (
    <TouchableOpacity className={rowClass} onPress={() => onOpen(channel)}>
      {content}
    </TouchableOpacity>
  );
}
