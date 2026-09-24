import type { Channel } from './channel'

export interface Server {
    id: string
    name: string
    description: string | null
    owner_id: string
    avatar_url: string | null
    created_at: string
    channels: Channel[]
}
