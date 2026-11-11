import type { RoleDeletionFailure } from './types';

/**
 * What a failed DELETE of a role means, by status. 403 and 409 come with the backend's reason; a
 * 404 is a role or a server that no longer exists, which the hook tells apart by reading the list.
 */
export const classifyRoleDeletionError = (error: unknown): RoleDeletionFailure => {
    const axiosLike = error as { isAxiosError?: boolean; response?: { status?: number } } | null;
    if (!axiosLike?.isAxiosError) return 'service';
    const status = axiosLike.response?.status;
    // No response at all: the request never reached the gateway.
    if (status === undefined) return 'network';
    if (status === 403 || status === 409) return 'rejected';
    if (status === 404) return 'gone';
    return 'service';
};
