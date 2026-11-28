import { useWindowDimensions, View } from 'react-native';
import { useVoice, useVoiceSpeakers, type ChannelParticipantView } from '@discordia/core';
import { tileWidth } from './gridLayout';
import { VoiceTile } from './VoiceTile';

// The call as a grid of tiles. Like VoiceCallParticipantList, it is the only reader of the speakers
// context, so a speaker change re-renders the grid and not the screen around it.
export const VoiceCallGrid = ({ participants }: { participants: ChannelParticipantView[] }) => {
  const speakingIds = useVoiceSpeakers();
  const { locallyMuted, toggleLocalMute } = useVoice();
  const { width } = useWindowDimensions();
  const size = tileWidth(width, participants.length);
  return (
    <View accessibilityLabel="Participantes de la llamada" className="flex-row flex-wrap gap-2">
      {participants.map((p) => (
        <VoiceTile
          key={p.userId}
          participant={p}
          // Muted never shows as speaking: the server takes ~0.5 s to notice a fresh mute (S8).
          speaking={!p.muted && speakingIds.has(p.userId)}
          locallyMuted={locallyMuted.has(p.userId)}
          width={size}
          // The handler is the controller's, stable: wrapping it per tile would break the memo.
          onToggleLocalMute={p.isSelf ? undefined : toggleLocalMute}
        />
      ))}
    </View>
  );
};
