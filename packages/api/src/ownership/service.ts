import type { AxiosInstance } from 'axios';
import type {
    OwnershipTransfer,
    OwnershipTransferListResponse,
    OwnershipTransferResponse,
} from './types';

const transferPath = (serverId: string) => `/api/v1/servers/${serverId}/ownership-transfer`;

/**
 * Ownership transfer of a server (SCRUM-35). Every action is on the single
 * pending transfer of the server, so there is no transfer id: the owner
 * proposes and cancels, the recipient accepts or rejects.
 */
export const createOwnershipService = (apiClient: AxiosInstance) => ({
    /**
     * The last transfer of the server, whatever its status. Only for the
     * owner: anyone else gets 403, and a server that never had one, 404.
     */
    getServerTransfer: (serverId: string): Promise<OwnershipTransfer> =>
        apiClient.get<OwnershipTransferResponse>(transferPath(serverId)).then(r => r.data.data),

    /** Proposes the server to another member. 409 if one is already pending. */
    proposeTransfer: (serverId: string, toUserId: string): Promise<OwnershipTransfer> =>
        apiClient
            .post<OwnershipTransferResponse>(transferPath(serverId), { to_user_id: toUserId })
            .then(r => r.data.data),

    /** Cancels the pending transfer. Idempotent: nothing pending answers the same. */
    cancelTransfer: (serverId: string): Promise<void> =>
        apiClient.delete(transferPath(serverId)).then(() => undefined),

    /** The recipient becomes the owner. Idempotent once accepted. */
    acceptTransfer: (serverId: string): Promise<void> =>
        apiClient.post(`${transferPath(serverId)}/acceptance`).then(() => undefined),

    /** The recipient turns the transfer down; the owner keeps the server. */
    rejectTransfer: (serverId: string): Promise<void> =>
        apiClient.post(`${transferPath(serverId)}/rejection`).then(() => undefined),

    /** The pending transfers waiting for the caller's answer, one per server at most. */
    listMyTransfers: (): Promise<OwnershipTransfer[]> =>
        apiClient
            .get<OwnershipTransferListResponse>('/api/v1/users/me/ownership-transfers')
            .then(r => r.data.data),
});
