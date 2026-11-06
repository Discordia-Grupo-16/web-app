import type { OutgoingOwnershipTransfer, UseOutgoingOwnershipTransferOptions } from './types';

const noop = () => undefined;

export const useOutgoingOwnershipTransfer = (_options: UseOutgoingOwnershipTransferOptions): OutgoingOwnershipTransfer => ({
    view: { kind: 'none' },
    loading: false,
    busy: null,
    error: null,
    reload: noop,
    propose: async () => false,
    cancel: async () => undefined,
    retry: noop,
    dismissError: noop,
    dismissRejection: noop,
});
