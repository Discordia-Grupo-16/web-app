import { memo } from 'react';
import { MicOff, Volume2, VolumeX } from 'lucide-react';
import { VOICE_TEXTS, type ChannelParticipantView } from '@discordia/core';

export interface VoiceParticipantListProps {
    participants: ChannelParticipantView[];
    /** compact: under the channel in the sidebar; roomy: in the channel panel. */
    variant?: 'compact' | 'roomy';
    /** Who is speaking now. Without it nobody is highlighted, like in the roster, which does not know. */
    speakingIds?: ReadonlySet<string>;
    /** Whom this user stopped hearing. Without it nobody shows as muted locally, like in the roster. */
    locallyMuted?: ReadonlySet<string>;
    /** Mutes or unmutes someone locally. The button shows only in the roomy list, on the rows of the others. */
    onToggleLocalMute?: (userId: string) => void;
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

interface ParticipantRowProps {
    participant: ChannelParticipantView;
    roomy: boolean;
    speaking: boolean;
    locallyMuted: boolean;
    onToggleLocalMute?: (userId: string) => void;
}

// Memoized: when who is speaking changes, only the rows whose `speaking` flipped render again.
const ParticipantRow = memo(({ participant: p, roomy, speaking, locallyMuted, onToggleLocalMute }: ParticipantRowProps) => {
    const iconSize = roomy ? 16 : 12;
    const localMuteLabel = locallyMuted ? VOICE_TEXTS.localUnmute : VOICE_TEXTS.localMute;
    return (
        <li
            // 'muted': seen speaking but silenced on this device, so the ring is grey.
            data-speaking={speaking ? (locallyMuted ? 'muted' : 'true') : undefined}
            className={`flex items-center gap-2 min-w-0 ${roomy ? 'px-3 py-2 rounded-md' : 'py-0.5'}`}
            style={roomy ? { background: '#2f3136' } : undefined}
        >
            <span
                aria-hidden
                className={`relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-display font-bold text-white transition-shadow duration-150 ${roomy ? 'w-8 h-8 text-sm' : 'w-5 h-5 text-xs'}`}
                style={{
                    background: p.loading ? '#4f545c' : p.userAvatar ? 'transparent' : '#5b6eae',
                    boxShadow: speaking ? '0 0 0 2px ' + (locallyMuted ? '#72767d' : '#3ba55d') : undefined,
                }}
            >
                {p.loading ? '' : p.userAvatar ? (
                    <img src={p.userAvatar} alt="" className="absolute inset-0 block w-full h-full object-cover" />
                ) : (
                    initial(p.name)
                )}
            </span>
            <span
                className={`truncate ${roomy ? 'text-sm' : 'text-xs'} ${p.loading ? 'italic' : ''}`}
                style={{ color: p.loading ? '#72767d' : '#dcddde' }}
                aria-busy={p.loading || undefined}
            >
                {p.name}
            </span>
            {(p.muted || onToggleLocalMute || locallyMuted) && (
                <span className="ml-auto flex items-center gap-1 shrink-0">
                    {p.muted && (
                        <MicOff size={iconSize} aria-label="Silenciado" className="shrink-0" style={{ color: '#b9bbbe' }} />
                    )}
                    {onToggleLocalMute ? (
                        <button
                            type="button"
                            aria-label={localMuteLabel}
                            aria-pressed={locallyMuted}
                            title={localMuteLabel}
                            className="shrink-0 flex items-center"
                            onClick={() => onToggleLocalMute(p.userId)}
                        >
                            {locallyMuted ? (
                                <VolumeX size={iconSize} style={{ color: '#ed4245' }} />
                            ) : (
                                <Volume2 size={iconSize} style={{ color: '#b9bbbe' }} />
                            )}
                        </button>
                    ) : (
                        locallyMuted && (
                            <VolumeX
                                size={iconSize}
                                aria-label={VOICE_TEXTS.locallyMuted}
                                className="shrink-0"
                                style={{ color: '#ed4245' }}
                            />
                        )
                    )}
                </span>
            )}
        </li>
    );
});

export const VoiceParticipantList = ({
    participants,
    variant = 'compact',
    speakingIds,
    locallyMuted,
    onToggleLocalMute,
}: VoiceParticipantListProps) => {
    const roomy = variant === 'roomy';
    return (
        <ul aria-label="Participantes del canal" className={roomy ? 'flex flex-col gap-1' : 'flex flex-col pl-7 pr-2 pb-1'}>
            {participants.map(p => (
                <ParticipantRow
                    key={p.userId}
                    participant={p}
                    roomy={roomy}
                    // Muted never shows as speaking: the server takes ~0.5 s to notice a fresh mute (S8).
                    speaking={!p.muted && (speakingIds?.has(p.userId) ?? false)}
                    locallyMuted={locallyMuted?.has(p.userId) ?? false}
                    // The handler is the controller's, stable: wrapping it per row would break the memo.
                    onToggleLocalMute={roomy && !p.isSelf ? onToggleLocalMute : undefined}
                />
            ))}
        </ul>
    );
};
