import { describe, expect, it } from 'vitest';
import { authorView, displayName, UNAVAILABLE_USER_NAME } from './authorName';

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

describe('authorView', () => {
    const authorId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const me = { id: 'me', name: 'Felipe', avatarUrl: 'https://cdn/me.png' };
    const profile = { id: authorId, name: 'Milton', avatarUrl: 'https://cdn/milton.png', bio: null };

    it('uses the session for the current user, without waiting for the profile', () => {
        expect(authorView('me', me, undefined)).toEqual({ name: 'Felipe', avatarUrl: 'https://cdn/me.png' });
    });

    it('uses the public profile of other authors', () => {
        expect(authorView(authorId, me, profile)).toEqual({ name: 'Milton', avatarUrl: 'https://cdn/milton.png' });
    });

    it('shows the unavailable name when the account is suspended or does not exist', () => {
        expect(authorView(authorId, me, null)).toEqual({ name: UNAVAILABLE_USER_NAME, avatarUrl: null });
    });

    it('falls back to the short id while the profile is not loaded', () => {
        expect(authorView(authorId, me, undefined)).toEqual({ name: 'Usuario 7c9e6679', avatarUrl: null });
    });
});
