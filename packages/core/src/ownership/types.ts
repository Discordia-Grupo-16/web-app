import type { OwnershipTransfer } from '@discordia/api';

/** What the hooks need from the API. The app joins its ownership and servers services. */
export interface OwnershipTransferSource {
    getServerTransfer: (serverId: string) => Promise<OwnershipTransfer>;
    proposeTransfer: (serverId: string, toUserId: string) => Promise<OwnershipTransfer>;
    cancelTransfer: (serverId: string) => Promise<void>;
    acceptTransfer: (serverId: string) => Promise<void>;
    rejectTransfer: (serverId: string) => Promise<void>;
    listMyTransfers: () => Promise<OwnershipTransfer[]>;
    /** Only to tell an unavailable transfer from a deleted server after a 404 on accept. */
    getServer: (serverId: string) => Promise<unknown>;
    /** The servers of whoever asks: the banner only shows transfers of servers still there. */
    getServers: () => Promise<ReadonlyArray<{ id: string }>>;
}

export type OwnershipAction = 'propose' | 'cancel' | 'accept' | 'reject';

/** What the classifier returns. `conflict` and `gone-or-unavailable` are resolved by the hook. */
export type OwnershipFailure =
    | 'not-owner'
    | 'not-member'
    | 'unavailable'
    | 'server-gone'
    | 'network'
    | 'service'
    | 'conflict'
    | 'gone-or-unavailable';

/** What the user sees. */
export type OwnershipError =
    | { kind: 'not-owner' }
    | { kind: 'not-member' }
    | { kind: 'already-pending'; toUserId: string; toName: string }
    | { kind: 'unavailable' }
    | { kind: 'server-gone' }
    | { kind: 'network' }
    | { kind: 'service' };

/** The owner's transfer in the open server. */
export type OutgoingTransferView =
    | { kind: 'none' }
    | { kind: 'pending'; toUserId: string; toName: string; toNameLoading: boolean; createdAt: string }
    | { kind: 'rejected'; toUserId: string; toName: string; toNameLoading: boolean; createdAt: string };

/**
 * Where each platform remembers, per server, the rejection the owner closed on this device:
 * localStorage on web, AsyncStorage on mobile. A later rejection has another createdAt, so it shows.
 */
export interface DismissedRejectionStore {
    /** The createdAt of the rejection closed on this device, or null if none was. */
    get: (serverId: string) => Promise<string | null>;
    set: (serverId: string, createdAt: string) => Promise<void>;
}

export interface UseOutgoingOwnershipTransferOptions {
    source: OwnershipTransferSource;
    dismissedRejections: DismissedRejectionStore;
    /** undefined outside a server: the hook asks for nothing. */
    serverId: string | undefined;
    /** Only the owner asks for its transfer: for anyone else the endpoint answers 403. */
    isOwner: boolean;
}

export interface OutgoingOwnershipTransfer {
    view: OutgoingTransferView;
    loading: boolean;
    busy: 'proposing' | 'cancelling' | null;
    error: OwnershipError | null;
    reload: () => void;
    /** true if a pending transfer to toUserId is left, also when it already existed. */
    propose: (toUserId: string) => Promise<boolean>;
    cancel: () => Promise<void>;
    /** Repeats the last action that failed. */
    retry: () => void;
    dismissError: () => void;
    /** Hides "<name> rechazó la transferencia" on this device, also after a reload. */
    dismissRejection: () => void;
}

export interface IncomingTransferView {
    serverId: string;
    serverName: string;
    fromUserId: string;
    fromName: string;
    fromNameLoading: boolean;
    busy: 'accepting' | 'rejecting' | null;
    error: OwnershipError | null;
    /** true once the transfer is unavailable or the server is gone: the banner only shows the error and "Cerrar". */
    stale: boolean;
}

export interface UseIncomingOwnershipTransfersOptions {
    source: OwnershipTransferSource;
    /** false without a session. Default: true. */
    enabled?: boolean;
}

export interface IncomingOwnershipTransfers {
    transfers: IncomingTransferView[];
    reload: () => void;
    accept: (serverId: string) => Promise<void>;
    reject: (serverId: string) => Promise<void>;
    retry: (serverId: string) => void;
    /** Removes a stale banner and clears its error. */
    dismiss: (serverId: string) => void;
}
