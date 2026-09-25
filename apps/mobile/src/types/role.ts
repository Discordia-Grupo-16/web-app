export interface Role {
    id: string;
    server_id: string;
    name: string;
    is_default: boolean;
    permissions: number;
    position: number;
    created_at: string;
}
