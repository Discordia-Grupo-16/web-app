import type { ReactionChip } from '@discordia/core';

interface ReactionBarProps {
    chips: ReactionChip[];
    /** ADD_REACTIONS. Without it the chips of others cannot be joined, but the counts are still shown. */
    canAddReactions: boolean;
    /** `reacted` is what the user asks for: true to add, false to take their reaction back. */
    onToggle: (emoji: string, reacted: boolean) => void;
}

const people = (count: number): string => (count === 1 ? '1 persona' : `${count} personas`);

/** The reactions of a message (SCRUM-49): one chip per emoji with its count, the user's own highlighted. */
export const ReactionBar = ({ chips, canAddReactions, onToggle }: ReactionBarProps) => {
    if (chips.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-1">
            {chips.map((chip) => (
                <button
                    key={chip.emoji}
                    type="button"
                    aria-pressed={chip.mine}
                    aria-label={`${chip.mine ? 'Reaccionaste' : 'Reaccionar'} con ${chip.emoji}, ${people(chip.count)}`}
                    // Taking back one's own reaction only needs to see the channel, as on the server: the
                    // own chip works even after losing ADD_REACTIONS.
                    disabled={!chip.mine && !canAddReactions}
                    onClick={() => onToggle(chip.emoji, !chip.mine)}
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border disabled:cursor-default"
                    style={{
                        background: chip.mine ? 'rgba(88, 101, 242, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                        borderColor: chip.mine ? '#5865f2' : 'transparent',
                        color: '#dcddde',
                    }}
                >
                    <span>{chip.emoji}</span>
                    <span className="font-semibold">{chip.count}</span>
                </button>
            ))}
        </div>
    );
};
