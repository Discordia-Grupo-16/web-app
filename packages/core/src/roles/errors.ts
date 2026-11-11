import type { RoleDeletionFailure } from './types';

export const classifyRoleDeletionError = (_error: unknown): RoleDeletionFailure => {
    throw new Error('not implemented');
};
