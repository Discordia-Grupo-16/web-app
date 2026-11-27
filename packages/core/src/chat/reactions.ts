import type { ReactionDto } from '@discordia/api';

/**
 * The emojis the picker offers (SCRUM-49). A fixed list is enough for the acceptance criteria and
 * needs no emoji library; the server accepts any single Unicode emoji, so a reaction someone else
 * added with another emoji is still shown and can be joined from its chip.
 */
export const QUICK_REACTIONS: readonly string[] = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

/** What a chip shows: the emoji, how many reacted with it and whether the user is one of them. */
export interface ReactionChip {
    emoji: string;
    count: number;
    mine: boolean;
}

/** Whether the user is among the ones who reacted with that emoji. */
export const hasReacted = (reaction: ReactionDto, userId: string | null | undefined): boolean =>
    !!userId && reaction.userIds.includes(userId);

/**
 * The chips of a message, in the server's order (the order each emoji was first added), so they do
 * not jump around when the counts change. An entry with nobody left is skipped: the server removes
 * it, but a client must not draw a "0".
 */
export const reactionSummary = (
    reactions: ReadonlyArray<ReactionDto> | undefined,
    userId: string | null | undefined,
): ReactionChip[] =>
    (reactions ?? [])
        .filter((reaction) => reaction.userIds.length > 0)
        .map((reaction) => ({
            emoji: reaction.emoji,
            count: reaction.userIds.length,
            mine: hasReacted(reaction, userId),
        }));
