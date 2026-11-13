import { describe, expect, it, vi } from 'vitest';
import type { AxiosInstance } from 'axios';
import { createWsTicketGetter } from './ticket';

const fakeApi = (post: ReturnType<typeof vi.fn>) => ({ post }) as unknown as AxiosInstance;

describe('createWsTicketGetter', () => {
    it('posts to /api/v1/ws-ticket and returns the ticket', async () => {
        const post = vi.fn(async () => ({ data: { data: { ticket: 't-1', expiresIn: 30 } } }));
        const getTicket = createWsTicketGetter(fakeApi(post));

        await expect(getTicket()).resolves.toBe('t-1');
        expect(post).toHaveBeenCalledWith('/api/v1/ws-ticket');
    });

    it('asks for a new ticket on every call', async () => {
        const post = vi
            .fn()
            .mockResolvedValueOnce({ data: { data: { ticket: 'a', expiresIn: 30 } } })
            .mockResolvedValueOnce({ data: { data: { ticket: 'b', expiresIn: 30 } } });
        const getTicket = createWsTicketGetter(fakeApi(post));

        expect(await getTicket()).toBe('a');
        expect(await getTicket()).toBe('b');
    });

    it('resolves null on 401 so the client closes instead of retrying', async () => {
        const post = vi.fn().mockRejectedValue({ response: { status: 401 } });
        await expect(createWsTicketGetter(fakeApi(post))()).resolves.toBeNull();
    });

    it('rethrows other failures so the client reconnects with backoff', async () => {
        const post = vi.fn().mockRejectedValue({ response: { status: 503 } });
        await expect(createWsTicketGetter(fakeApi(post))()).rejects.toEqual({ response: { status: 503 } });
    });
});
