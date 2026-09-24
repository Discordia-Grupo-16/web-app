export interface Channel {
    id: string;
    server_id: string;
    name: string;
    type: 'text' | 'voice';
    topic: string | null;
    position: number;
    created_at: string;
}
