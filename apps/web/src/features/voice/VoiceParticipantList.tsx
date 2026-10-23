import { MicOff } from 'lucide-react';
import type { ChannelParticipantView } from '@discordia/core';

interface VoiceParticipantListProps {
    participants: ChannelParticipantView[];
    /** compact: under the channel in the sidebar; roomy: in the channel panel. */
    variant?: 'compact' | 'roomy';
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

export const VoiceParticipantList = ({ participants, variant = 'compact' }: VoiceParticipantListProps) => {
    const roomy = variant === 'roomy';
    return (
        <ul aria-label="Participantes de la llamada" className={roomy ? 'flex flex-col gap-1' : 'flex flex-col pl-7 pr-2 pb-1'}>
            {participants.map(p => (
                <li
                    key={p.userId}
                    className={`flex items-center gap-2 min-w-0 ${roomy ? 'px-3 py-2 rounded-md' : 'py-0.5'}`}
                    style={roomy ? { background: '#2f3136' } : undefined}
                >
                    <span
                        aria-hidden
                        className={`shrink-0 rounded-full flex items-center justify-center font-display font-bold text-white ${roomy ? 'w-8 h-8 text-sm' : 'w-5 h-5 text-[10px]'}`}
                        style={{ background: p.loading ? '#4f545c' : '#5b6eae' }}
                    >
                        {p.loading ? '' : initial(p.name)}
                    </span>
                    <span
                        className={`truncate ${roomy ? 'text-sm' : 'text-xs'} ${p.loading ? 'italic' : ''}`}
                        style={{ color: p.loading ? '#72767d' : '#dcddde' }}
                        aria-busy={p.loading || undefined}
                    >
                        {p.name}
                    </span>
                    {p.muted && (
                        <MicOff
                            size={roomy ? 16 : 12}
                            aria-label="Silenciado"
                            className="ml-auto shrink-0"
                            style={{ color: '#b9bbbe' }}
                        />
                    )}
                </li>
            ))}
        </ul>
    );
};
