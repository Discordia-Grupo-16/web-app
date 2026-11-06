import type { IncomingOwnershipTransfers, UseIncomingOwnershipTransfersOptions } from './types';

const noop = () => undefined;

export const useIncomingOwnershipTransfers = (
    _options: UseIncomingOwnershipTransfersOptions,
): IncomingOwnershipTransfers => ({
    transfers: [],
    reload: noop,
    accept: async () => undefined,
    reject: async () => undefined,
    retry: noop,
    dismiss: noop,
});
