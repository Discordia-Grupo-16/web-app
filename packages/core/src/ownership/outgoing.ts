import type { OwnershipTransfer } from '@discordia/api';
import type { OutgoingTransferView } from './types';

export type OutgoingViewBase = Pick<OutgoingTransferView, 'kind'> & Partial<{ toUserId: string; createdAt: string }>;

export const toOutgoingView = (
    _latest: OwnershipTransfer | null,
    _dismissedRejectionAt: string | null,
): OutgoingViewBase => ({ kind: 'none' });
