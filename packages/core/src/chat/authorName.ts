import type { PublicUser, User } from '@discordia/api';

export const UNAVAILABLE_USER_NAME = 'Usuario no disponible';

export interface AuthorView {
    name: string;
    avatarUrl: string | null;
}

// Fallback while the public profile loads (or if it could not be loaded).
export const displayName = (authorId: string, currentUser: Pick<User, 'id' | 'name'> | null): string => {
    if (currentUser && authorId === currentUser.id) return currentUser.name || 'Vos';
    return `Usuario ${authorId.slice(0, 8)}`;
};

// profile: undefined means "not loaded", null means "not available" (suspended or nonexistent).
// The own user always comes from the session, so an edit shows up without waiting for the cache.
export const authorView = (
    authorId: string,
    currentUser: Pick<User, 'id' | 'name' | 'avatarUrl'> | null,
    profile: PublicUser | null | undefined,
): AuthorView => {
    if (currentUser && authorId === currentUser.id) {
        return { name: currentUser.name || 'Vos', avatarUrl: currentUser.avatarUrl ?? null };
    }
    if (profile === null) return { name: UNAVAILABLE_USER_NAME, avatarUrl: null };
    if (profile) return { name: profile.name, avatarUrl: profile.avatarUrl };
    return { name: displayName(authorId, currentUser), avatarUrl: null };
};
