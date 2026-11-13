import type { OwnershipAction, OwnershipFailure } from './types';

// What each action means by each status. A status the action does not expect is a service failure.
const BY_STATUS: Record<OwnershipAction, Partial<Record<number, OwnershipFailure>>> = {
    propose: { 403: 'not-owner', 404: 'server-gone', 409: 'conflict', 422: 'not-member' },
    cancel: { 403: 'not-owner', 404: 'server-gone' },
    // A 403 means the pending transfer is someone else's now. A 404 is either no pending
    // transfer or a deleted server: the hook asks for the server to tell them apart.
    accept: { 403: 'unavailable', 404: 'gone-or-unavailable' },
    reject: { 403: 'unavailable', 404: 'server-gone' },
};

export const classifyOwnershipError = (error: unknown, action: OwnershipAction): OwnershipFailure => {
    const axiosLike = error as { isAxiosError?: boolean; response?: { status?: number } } | null;
    if (!axiosLike?.isAxiosError) return 'service';
    const status = axiosLike.response?.status;
    // No response at all: the request never reached the gateway.
    if (status === undefined) return 'network';
    return BY_STATUS[action][status] ?? 'service';
};
