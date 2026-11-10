import { useVoice, useVoiceSpeakers } from '@discordia/core';
import { VoiceParticipantList, type VoiceParticipantListProps } from './VoiceParticipantList';

// The list of the call, with who is speaking and the local mutes. It is the only reader of the speakers
// context, so a speaker change re-renders this list and not the panel around it.
export const VoiceCallParticipantList = (
    props: Omit<VoiceParticipantListProps, 'speakingIds' | 'locallyMuted' | 'onToggleLocalMute'>,
) => {
    const speakingIds = useVoiceSpeakers();
    const { locallyMuted, toggleLocalMute } = useVoice();
    return (
        <VoiceParticipantList
            {...props}
            speakingIds={speakingIds}
            locallyMuted={locallyMuted}
            onToggleLocalMute={toggleLocalMute}
        />
    );
};
