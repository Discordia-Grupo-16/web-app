import type { OwnershipTransfer } from '@discordia/api';
import type { OutgoingTransferView } from './types';

export type OutgoingViewBase = Pick<OutgoingTransferView, 'kind'> & Partial<{ toUserId: string; createdAt: string }>;

/**
 * What the owner sees about the last transfer of the server. A rejection stays
 * until the owner proposes again or closes it on this device; an accepted or
 * cancelled transfer shows nothing.
 */
export const toOutgoingView = (
    latest: OwnershipTransfer | null,
    dismissedRejectionAt: string | null,
): OutgoingViewBase => {
    if (latest === null) return { kind: 'none' };
    const recipient = { toUserId: latest.to_user_id, createdAt: latest.created_at };
    if (latest.status === 'pending') return { kind: 'pending', ...recipient };
    // created_at tells one rejection from the next: closing one does not hide a later one.
    if (latest.status === 'rejected' && latest.created_at !== dismissedRejectionAt) {
        return { kind: 'rejected', ...recipient };
    }
    return { kind: 'none' };
};
