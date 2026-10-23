export interface Role {
    id: string
    server_id: string
    name: string
    is_default: boolean
    /** Bitmask of the role's permissions in the server. */
    permissions: number
    /** The same permissions by name, as the API returns them. */
    permission_names: string[]
    position: number
    created_at: string
}
