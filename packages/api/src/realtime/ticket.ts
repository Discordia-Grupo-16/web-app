import type { AxiosInstance } from 'axios';

interface WsTicketResponse {
    data: { ticket: string; expiresIn: number };
}

/**
 * Builds the `getTicket` the realtime client needs. Every call asks the gateway for a new
 * single-use ticket (POST /api/v1/ws-ticket), through the same axios instance as the rest of the
 * app, so an expired access token is refreshed before the ticket is requested.
 *
 * A 401 means there is no usable session (the refresh also failed): it resolves null and the
 * client closes instead of retrying. Any other failure rejects and the client reconnects with backoff.
 */
export function createWsTicketGetter(apiClient: AxiosInstance): () => Promise<string | null> {
    return async () => {
        try {
            const { data } = await apiClient.post<WsTicketResponse>('/api/v1/ws-ticket');
            return data.data.ticket;
        } catch (error) {
            if ((error as { response?: { status?: number } }).response?.status === 401) return null;
            throw error;
        }
    };
}
