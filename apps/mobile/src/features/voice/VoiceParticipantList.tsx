import { memo } from 'react';
import { Text, View } from 'react-native';
import type { ChannelParticipantView } from '@discordia/core';
import { MicOffIcon } from './MicOffIcon';

export interface VoiceParticipantListProps {
  participants: ChannelParticipantView[];
  /** compact: under the channel in the server screen; roomy: in the channel screen. */
  variant?: 'compact' | 'roomy';
  /** Who is speaking now. Without it nobody is highlighted, like in the roster, which does not know. */
  speakingIds?: ReadonlySet<string>;
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

interface ParticipantRowProps {
  participant: ChannelParticipantView;
  roomy: boolean;
  speaking: boolean;
}

// Memoized: when who is speaking changes, only the rows whose `speaking` flipped render again.
const ParticipantRow = memo(({ participant: p, roomy, speaking }: ParticipantRowProps) => (
  <View className={`flex-row items-center gap-2 ${roomy ? 'bg-[#2f3136] rounded-md px-3 py-2' : 'py-1'}`}>
    {/* The border is always there, so the avatar does not change size when the ring turns on. */}
    <View
      testID={speaking ? `voice-speaking-${p.userId}` : undefined}
      className={`rounded-full items-center justify-center border-2 ${roomy ? 'w-8 h-8' : 'w-5 h-5'} ${
        p.loading ? 'bg-[#4f545c]' : 'bg-[#5b6eae]'
      } ${speaking ? 'border-[#3ba55d]' : 'border-transparent'}`}
    >
      {!p.loading && (
        <Text className={`text-white font-bold ${roomy ? 'text-sm' : 'text-[10px]'}`}>{initial(p.name)}</Text>
      )}
    </View>
    <Text
      numberOfLines={1}
      accessibilityState={{ busy: p.loading }}
      className={`flex-1 ${roomy ? 'text-sm' : 'text-xs'} ${p.loading ? 'italic text-[#72767d]' : 'text-[#dcddde]'}`}
    >
      {p.name}
    </Text>
    {p.muted && <MicOffIcon size={roomy ? 16 : 12} />}
  </View>
));

export const VoiceParticipantList = ({ participants, variant = 'compact', speakingIds }: VoiceParticipantListProps) => {
  const roomy = variant === 'roomy';
  return (
    <View accessibilityLabel="Participantes del canal" className={roomy ? 'gap-1' : 'pl-8 pr-2 pb-1'}>
      {participants.map((p) => (
        <ParticipantRow
          key={p.userId}
          participant={p}
          roomy={roomy}
          // Muted never shows as speaking: the server takes ~0.5 s to notice a fresh mute (S8).
          speaking={!p.muted && (speakingIds?.has(p.userId) ?? false)}
        />
      ))}
    </View>
  );
};
