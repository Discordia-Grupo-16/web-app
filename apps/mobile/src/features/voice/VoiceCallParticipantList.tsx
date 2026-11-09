import { useVoiceSpeakers } from '@discordia/core';
import { VoiceParticipantList, type VoiceParticipantListProps } from './VoiceParticipantList';

// The list of the call, with who is speaking. It is the only reader of the speakers context, so a
// speaker change re-renders this list and not the screen around it.
export const VoiceCallParticipantList = (props: Omit<VoiceParticipantListProps, 'speakingIds'>) => {
  const speakingIds = useVoiceSpeakers();
  return <VoiceParticipantList {...props} speakingIds={speakingIds} />;
};
