import { MicOff, Volume2, VolumeX } from 'lucide-react';
import {
    isRetryableJoinError,
    useVoice,
    useVoiceCallParticipants,
    VOICE_JOIN_ERROR_TEXTS,
    VOICE_TEXTS,
    type VoiceChannelRef,
    type VoiceParticipant,
} from '@discordia/core';
import { VoiceParticipantList } from './VoiceParticipantList';

const NO_PARTICIPANTS: VoiceParticipant[] = [];

const primaryButton =
    'px-5 py-2 rounded-md text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default';

export const VoiceChannelPanel = ({ channel }: { channel: VoiceChannelRef }) => {
    const { call, attempt, available, audioBlocked, join, retry, startAudio } = useVoice();
    const inCall = call.status === 'connected' && call.channel.id === channel.id;
    const participants = useVoiceCallParticipants(inCall ? call.participants : NO_PARTICIPANTS);
    const ownAttempt = attempt?.channel.id === channel.id ? attempt : null;

    if (inCall) {
        return (
            <section aria-label="Llamada" className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-md mx-auto flex flex-col gap-4">
                    <p className="text-sm font-semibold" style={{ color: '#3ba55d' }}>
                        Estás en la llamada
                    </p>
                    {!call.micAvailable && (
                        <div role="status" className="flex gap-3 p-3 rounded-md text-sm" style={{ background: '#3a3d43', color: '#dcddde' }}>
                            <MicOff size={18} className="shrink-0 mt-0.5" style={{ color: '#faa61a' }} />
                            <div>
                                <p>{VOICE_TEXTS.noMic}</p>
                                {call.micBlocked && <p className="mt-1" style={{ color: '#b9bbbe' }}>{VOICE_TEXTS.micBlockedWeb}</p>}
                            </div>
                        </div>
                    )}
                    {audioBlocked && (
                        <div className="flex items-center gap-3 p-3 rounded-md text-sm" style={{ background: '#3a3d43', color: '#dcddde' }}>
                            <VolumeX size={18} className="shrink-0" style={{ color: '#faa61a' }} />
                            <p className="flex-1">El navegador pausó el audio de la llamada.</p>
                            <button onClick={startAudio} className={primaryButton} style={{ background: '#5865f2' }}>
                                Activar audio
                            </button>
                        </div>
                    )}
                    <VoiceParticipantList participants={participants} variant="roomy" />
                </div>
            </section>
        );
    }

    const connecting = ownAttempt?.status === 'connecting';
    const failed = ownAttempt?.status === 'failed' ? ownAttempt : null;

    return (
        <section aria-label="Canal de voz" className="flex-1 flex items-center justify-center px-6">
            <div className="flex flex-col items-center text-center gap-4 max-w-sm">
                <span className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#2f3136', color: '#b9bbbe' }}>
                    <Volume2 size={36} />
                </span>
                <p className="font-display text-xl font-bold text-white">{channel.name}</p>

                {!available ? (
                    <p className="text-sm" style={{ color: '#b9bbbe' }}>{VOICE_JOIN_ERROR_TEXTS.unavailable}</p>
                ) : failed ? (
                    <>
                        <p role="alert" className="text-sm" style={{ color: '#f38688' }}>
                            {VOICE_JOIN_ERROR_TEXTS[failed.error]}
                        </p>
                        {isRetryableJoinError(failed.error) && (
                            <button onClick={retry} className={primaryButton} style={{ background: '#4f545c' }}>
                                Reintentar
                            </button>
                        )}
                    </>
                ) : (
                    <button
                        onClick={() => join(channel)}
                        disabled={connecting}
                        aria-busy={connecting || undefined}
                        className={primaryButton}
                        style={{ background: connecting ? '#2d7d46' : '#3ba55d' }}
                    >
                        {connecting ? VOICE_TEXTS.connecting : 'Unirse'}
                    </button>
                )}
            </div>
        </section>
    );
};
