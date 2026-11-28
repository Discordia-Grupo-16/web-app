import { memo, useContext } from 'react';
import { MicOff, Volume2, VolumeX } from 'lucide-react';
import { VOICE_TEXTS, type ChannelParticipantView } from '@discordia/core';
import { CameraVideo } from './CameraVideo';
import { participantInitial } from './participantInitial';
import { VoiceVideoContext } from './videoContext';

export interface VoiceTileProps {
    participant: ChannelParticipantView;
    speaking: boolean;
    locallyMuted: boolean;
    /** Mutes or unmutes this participant locally. The button shows only when it is given: not on the own tile. */
    onToggleLocalMute?: (userId: string) => void;
}

// One participant of the call: their video if they have a camera on, their avatar if not. Memoized like
// the rows of the list: when who is speaking changes, only the tiles whose `speaking` flipped render again.
export const VoiceTile = memo(({ participant: p, speaking, locallyMuted, onToggleLocalMute }: VoiceTileProps) => {
    const lookupCamera = useContext(VoiceVideoContext);
    // cameraOn is "there is something to show", but the track can still be gone by the time this renders.
    const track = p.cameraOn ? lookupCamera(p.userId)?.publication.videoTrack : undefined;
    const localMuteLabel = locallyMuted ? VOICE_TEXTS.localUnmute : VOICE_TEXTS.localMute;
    return (
        <li
            // 'muted': seen speaking but silenced on this device, so the ring is grey.
            data-speaking={speaking ? (locallyMuted ? 'muted' : 'true') : undefined}
            className="relative aspect-video rounded-md overflow-hidden min-w-0"
            style={{ background: '#2f3136' }}
        >
            {track ? (
                <CameraVideo track={track} mirror={!!p.isSelf} />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span
                        aria-hidden
                        className="relative shrink-0 w-16 h-16 rounded-full overflow-hidden flex items-center justify-center font-display font-bold text-white text-2xl"
                        style={{ background: p.loading ? '#4f545c' : p.userAvatar ? 'transparent' : '#5b6eae' }}
                    >
                        {p.loading ? '' : p.userAvatar ? (
                            <img src={p.userAvatar} alt="" className="absolute inset-0 block w-full h-full object-cover" />
                        ) : (
                            participantInitial(p.name)
                        )}
                    </span>
                </div>
            )}
            {/* On top of the video: an inset box-shadow on the <li> would be hidden behind it. */}
            <span
                aria-hidden
                className="absolute inset-0 rounded-md pointer-events-none transition-shadow duration-150"
                style={{ boxShadow: speaking ? 'inset 0 0 0 2px ' + (locallyMuted ? '#72767d' : '#3ba55d') : undefined }}
            />
            <span
                className={`absolute left-2 bottom-2 max-w-[calc(100%-1rem)] truncate px-1.5 py-0.5 rounded text-xs ${p.loading ? 'italic' : ''}`}
                style={{ background: 'rgba(0,0,0,0.6)', color: p.loading ? '#b9bbbe' : '#dcddde' }}
                aria-busy={p.loading || undefined}
            >
                {p.name}
            </span>
            {(p.muted || onToggleLocalMute) && (
                <span className="absolute right-2 top-2 flex items-center gap-1">
                    {p.muted && (
                        <span className="flex items-center rounded-full p-1" style={{ background: 'rgba(0,0,0,0.55)' }}>
                            <MicOff size={16} aria-label="Silenciado" className="shrink-0" style={{ color: '#b9bbbe' }} />
                        </span>
                    )}
                    {onToggleLocalMute && (
                        <button
                            type="button"
                            aria-label={localMuteLabel}
                            aria-pressed={locallyMuted}
                            title={localMuteLabel}
                            className="shrink-0 flex items-center rounded-full p-1"
                            style={{ background: 'rgba(0,0,0,0.55)' }}
                            onClick={() => onToggleLocalMute(p.userId)}
                        >
                            {locallyMuted ? (
                                <VolumeX size={16} style={{ color: '#ed4245' }} />
                            ) : (
                                <Volume2 size={16} style={{ color: '#b9bbbe' }} />
                            )}
                        </button>
                    )}
                </span>
            )}
        </li>
    );
});
