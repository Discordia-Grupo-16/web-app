import { describe, expect, it } from 'vitest';
import { QUICK_REACTIONS, hasReacted, reactionSummary } from './reactions';

describe('reactions', () => {
    const reactions = [
        { emoji: '🎉', userIds: ['u2'] },
        { emoji: '👍', userIds: ['u1', 'u2', 'u3'] },
    ];

    it('summarises each emoji with its count and whether it is the user\'s, in the server order', () => {
        expect(reactionSummary(reactions, 'u1')).toEqual([
            { emoji: '🎉', count: 1, mine: false },
            { emoji: '👍', count: 3, mine: true },
        ]);
    });

    it('skips an emoji nobody is left in: a chip must never show 0', () => {
        expect(reactionSummary([{ emoji: '👀', userIds: [] }, ...reactions], 'u2').map((c) => c.emoji)).toEqual(['🎉', '👍']);
    });

    it('a message without reactions, or from before they existed, has no chips', () => {
        expect(reactionSummary(undefined, 'u1')).toEqual([]);
        expect(reactionSummary([], 'u1')).toEqual([]);
    });

    it('without a known user nothing is the user\'s', () => {
        expect(reactionSummary(reactions, null).some((c) => c.mine)).toBe(false);
        expect(hasReacted(reactions[1], undefined)).toBe(false);
    });

    it('offers distinct emojis in the picker', () => {
        expect(new Set(QUICK_REACTIONS).size).toBe(QUICK_REACTIONS.length);
    });
});
