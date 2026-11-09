import { memo } from 'react';
import { MicOff } from 'lucide-react';
import type { ChannelParticipantView } from '@discordia/core';

export interface VoiceParticipantListProps {
    participants: ChannelParticipantView[];
    /** compact: under the channel in the sidebar; roomy: in the channel panel. */
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
    <li
        data-speaking={speaking || undefined}
        className={`flex items-center gap-2 min-w-0 ${roomy ? 'px-3 py-2 rounded-md' : 'py-0.5'}`}
        style={roomy ? { background: '#2f3136' } : undefined}
    >
        <span
            aria-hidden
            className={`shrink-0 rounded-full flex items-center justify-center font-display font-bold text-white transition-shadow duration-150 ${roomy ? 'w-8 h-8 text-sm' : 'w-5 h-5 text-[10px]'}`}
            style={{
                background: p.loading ? '#4f545c' : '#5b6eae',
                boxShadow: speaking ? '0 0 0 2px #3ba55d' : undefined,
            }}
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
));

export const VoiceParticipantList = ({ participants, variant = 'compact', speakingIds }: VoiceParticipantListProps) => {
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
                />
            ))}
        </ul>
    );
};
