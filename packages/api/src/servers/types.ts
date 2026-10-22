import type { Channel } from '../channels/types'

export interface Server {
    id: string
    name: string
    description: string | null
    owner_id: string
    avatar_url: string | null
    created_at: string
    channels: Channel[]
    /**
     * The permissions of whoever asked for the server, already resolved by
     * `community` (ADR-0011). The client only checks bits: it neither
     * computes them nor infers anything from `owner_id`.
     */
    my_permissions: number
    /** The same permissions by name. */
    my_permission_names: string[]
}
