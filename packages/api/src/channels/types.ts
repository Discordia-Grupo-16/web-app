export interface Channel {
    id: string
    server_id: string
    category_id: string | null
    name: string
    type: 'text' | 'voice'
    topic: string | null
    position: number
    created_at: string
}
