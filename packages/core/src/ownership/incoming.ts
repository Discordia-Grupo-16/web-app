import type { OwnershipTransfer } from '@discordia/api';

export const visibleIncoming = (
    _pending: readonly OwnershipTransfer[],
    _myServerIds: ReadonlySet<string>,
): OwnershipTransfer[] => [];
