import { describe, expect, it } from 'vitest';
import { displayName } from './authorName';

describe('displayName', () => {
    const authorId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

    it('returns the current user name when the author is the current user', () => {
        expect(displayName(authorId, { id: authorId, name: 'Milton' })).toBe('Milton');
    });

    it('falls back to "Vos" when the current user has no name', () => {
        expect(displayName(authorId, { id: authorId, name: '' })).toBe('Vos');
    });

    it('uses the first 8 characters of the id for other authors', () => {
        expect(displayName(authorId, { id: 'other-user', name: 'Milton' })).toBe('Usuario 7c9e6679');
    });

    it('uses the first 8 characters of the id when there is no current user', () => {
        expect(displayName(authorId, null)).toBe('Usuario 7c9e6679');
    });
});
