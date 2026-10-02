import type { User } from '@discordia/api';

// No endpoint resolves authorId to a name yet (known debt): replace this function when one exists.
export const displayName = (authorId: string, currentUser: Pick<User, 'id' | 'name'> | null): string => {
    if (currentUser && authorId === currentUser.id) return currentUser.name || 'Vos';
    return `Usuario ${authorId.slice(0, 8)}`;
};
