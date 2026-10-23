import { Text, View } from 'react-native';
import type { ChannelParticipantView } from '@discordia/core';
import { MicOffIcon } from './MicOffIcon';

interface VoiceParticipantListProps {
  participants: ChannelParticipantView[];
  /** compact: under the channel in the server screen; roomy: in the channel screen. */
  variant?: 'compact' | 'roomy';
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export const VoiceParticipantList = ({ participants, variant = 'compact' }: VoiceParticipantListProps) => {
  const roomy = variant === 'roomy';
  return (
    <View accessibilityLabel="Participantes de la llamada" className={roomy ? 'gap-1' : 'pl-8 pr-2 pb-1'}>
      {participants.map((p) => (
        <View
          key={p.userId}
          className={`flex-row items-center gap-2 ${roomy ? 'bg-[#2f3136] rounded-md px-3 py-2' : 'py-1'}`}
        >
          <View
            className={`rounded-full items-center justify-center ${roomy ? 'w-8 h-8' : 'w-5 h-5'} ${
              p.loading ? 'bg-[#4f545c]' : 'bg-[#5b6eae]'
            }`}
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
      ))}
    </View>
  );
};
