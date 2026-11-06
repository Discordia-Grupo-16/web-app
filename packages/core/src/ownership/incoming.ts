import type { OwnershipTransfer } from '@discordia/api';

/**
 * The pending transfers of servers the recipient is still in, in the order they
 * came. A deleted server leaves the recipient's list with the `servers` notice,
 * and with this filter its banner leaves too.
 */
export const visibleIncoming = (
    pending: readonly OwnershipTransfer[],
    myServerIds: ReadonlySet<string>,
): OwnershipTransfer[] => pending.filter((transfer) => myServerIds.has(transfer.server_id));
