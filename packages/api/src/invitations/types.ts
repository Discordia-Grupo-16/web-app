export interface Invitation {
    id: string
    server_id: string
    code: string
    created_by: string
    expires_at: string | null
    max_uses: number | null
    uses: number
    created_at: string
}

export interface Member {
    id: string
    server_id: string
    user_id: string
    joined_at: string
}
