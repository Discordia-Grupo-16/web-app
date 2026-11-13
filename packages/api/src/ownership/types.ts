/** The states of an ownership transfer (`community.yaml`, schema `OwnershipTransfer`). */
export type OwnershipTransferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'

/**
 * An ownership transfer of a server (SCRUM-35). It is not deleted when it is
 * resolved: it keeps its `status`, so the owner can tell a rejection from a
 * cancellation. In `snake_case`, like the rest of `community`.
 */
export interface OwnershipTransfer {
    server_id: string
    server_name: string
    from_user_id: string
    to_user_id: string
    status: OwnershipTransferStatus
    created_at: string
    /** `null` while the transfer is pending. */
    resolved_at: string | null
}

export interface OwnershipTransferResponse {
    data: OwnershipTransfer
}

export interface OwnershipTransferListResponse {
    data: OwnershipTransfer[]
}
