import { useVoice, useVoiceSpeakers, type ChannelParticipantView } from '@discordia/core';
import { gridColumns } from './gridColumns';
import { VoiceTile } from './VoiceTile';

// The call as a grid of tiles. Like VoiceCallParticipantList, it is the only reader of the speakers
// context, so a speaker change re-renders the grid and not the panel around it.
export const VoiceCallGrid = ({ participants }: { participants: ChannelParticipantView[] }) => {
    const speakingIds = useVoiceSpeakers();
    const { locallyMuted, toggleLocalMute } = useVoice();
    return (
        <ul
            aria-label="Participantes de la llamada"
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${gridColumns(participants.length)}, minmax(0, 1fr))` }}
        >
            {participants.map((p) => (
                <VoiceTile
                    key={p.userId}
                    participant={p}
                    // Muted never shows as speaking: the server takes ~0.5 s to notice a fresh mute (S8).
                    speaking={!p.muted && speakingIds.has(p.userId)}
                    locallyMuted={locallyMuted.has(p.userId)}
                    // The handler is the controller's, stable: wrapping it per tile would break the memo.
                    onToggleLocalMute={p.isSelf ? undefined : toggleLocalMute}
                />
            ))}
        </ul>
    );
};
