import type { Category } from '../categories/types'
import type { Channel } from '../channels/types'

export interface Server {
    id: string
    name: string
    description: string | null
    owner_id: string
    avatar_url: string | null
    banner_url: string | null
    created_at: string
    channels: Channel[]
    categories: Category[]
    /**
     * The permissions of whoever asked for the server, already resolved by
     * `community` (ADR-0011). The client only checks bits: it neither
     * computes them nor infers anything from `owner_id`.
     */
    my_permissions: number
    /** The same permissions by name. */
    my_permission_names: string[]
    /**
     * Until when whoever asked is muted in this server (SCRUM-71), in UTC with
     * `Z`. `null` if they are not, or if the mute already ended. Only
     * `GET /servers/{id}` fills it: the server list always carries `null`.
     * Compare it as a date, never as a string.
     */
    my_muted_until: string | null
}
