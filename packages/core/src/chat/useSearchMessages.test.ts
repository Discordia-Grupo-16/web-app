// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { type Mock, describe, expect, it, vi } from 'vitest';
import type { MessageDto } from '@discordia/api';
import { type SearchMessagesService, useSearchMessages } from './useSearchMessages';

const SERVER = 'server-1';

const idle = {
    results: [],
    loading: false,
    error: false,
    hasMore: false,
    loadingMore: false,
    loadMoreError: false,
    activeQuery: '',
    activeAuthor: '',
};

const msg = (id: string): MessageDto => ({
    messageId: id,
    channelId: 'ch-1',
    serverId: SERVER,
    authorId: 'user-1',
    content: `message ${id}`,
    createdAt: '2024-01-01T00:00:00Z',
    editedAt: null,
    clientMessageId: `client-${id}`,
});

function fakeService(overrides: { searchMessages?: Mock } = {}): SearchMessagesService {
    return {
        searchMessages: vi.fn().mockResolvedValue({ data: [], hasMore: false }),
        ...overrides,
    } as unknown as SearchMessagesService;
}

describe('useSearchMessages', () => {
    it('starts in idle state', () => {
        const { result } = renderHook(() => useSearchMessages(SERVER, fakeService()));
        expect(result.current.state).toEqual(idle);
    });

    it('sets loading and activeQuery/activeAuthor while searching', async () => {
        let resolveSearch!: (v: { data: MessageDto[]; hasMore: boolean }) => void;
        const service = fakeService({
            searchMessages: vi.fn(() => new Promise(r => { resolveSearch = r; })),
        });
        const { result } = renderHook(() => useSearchMessages(SERVER, service));

        act(() => { result.current.search('hola', 'frank'); });
        expect(result.current.state.loading).toBe(true);
        expect(result.current.state.activeQuery).toBe('hola');
        expect(result.current.state.activeAuthor).toBe('frank');

        await act(async () => { resolveSearch({ data: [], hasMore: false }); });
        expect(result.current.state.loading).toBe(false);
    });

    it('stores results and hasMore on success', async () => {
        const messages = [msg('1'), msg('2')];
        const service = fakeService({
            searchMessages: vi.fn().mockResolvedValue({ data: messages, hasMore: true }),
        });
        const { result } = renderHook(() => useSearchMessages(SERVER, service));

        await act(async () => { await result.current.search('hola'); });

        expect(result.current.state.results).toEqual(messages);
        expect(result.current.state.hasMore).toBe(true);
        expect(result.current.state.error).toBe(false);
    });

    it('passes q and author to the service', async () => {
        const service = fakeService();
        const { result } = renderHook(() => useSearchMessages(SERVER, service));

        await act(async () => { await result.current.search('hola', 'frank'); });

        expect(service.searchMessages).toHaveBeenCalledWith(SERVER, { q: 'hola', author: 'frank' });
    });

    it('passes undefined for empty q or author strings', async () => {
        const service = fakeService();
        const { result } = renderHook(() => useSearchMessages(SERVER, service));

        await act(async () => { await result.current.search('', 'frank'); });
        expect(service.searchMessages).toHaveBeenCalledWith(SERVER, { q: undefined, author: 'frank' });

        await act(async () => { await result.current.search('hola', ''); });
        expect(service.searchMessages).toHaveBeenCalledWith(SERVER, { q: 'hola', author: undefined });
    });

    it('sets error on service failure', async () => {
        const service = fakeService({
            searchMessages: vi.fn().mockRejectedValue(new Error('network error')),
        });
        const { result } = renderHook(() => useSearchMessages(SERVER, service));

        await act(async () => { await result.current.search('hola'); });

        expect(result.current.state.error).toBe(true);
        expect(result.current.state.loading).toBe(false);
        expect(result.current.state.results).toEqual([]);
    });

    it('resets old results when a new search is triggered', async () => {
        const service = fakeService({
            searchMessages: vi.fn()
                .mockResolvedValueOnce({ data: [msg('1')], hasMore: false })
                .mockResolvedValueOnce({ data: [msg('2')], hasMore: false }),
        });
        const { result } = renderHook(() => useSearchMessages(SERVER, service));

        await act(async () => { await result.current.search('first'); });
        expect(result.current.state.results).toHaveLength(1);

        await act(async () => { await result.current.search('second'); });
        expect(result.current.state.results).toEqual([msg('2')]);
        expect(result.current.state.activeQuery).toBe('second');
    });

    describe('loadMore', () => {
        it('appends results and passes cursor from last message of previous page', async () => {
            const page1 = [msg('1'), msg('2')];
            const page2 = [msg('3')];
            const service = fakeService({
                searchMessages: vi.fn()
                    .mockResolvedValueOnce({ data: page1, hasMore: true })
                    .mockResolvedValueOnce({ data: page2, hasMore: false }),
            });
            const { result } = renderHook(() => useSearchMessages(SERVER, service));

            await act(async () => { await result.current.search('hola', 'frank'); });
            await act(async () => { await result.current.loadMore(); });

            expect(service.searchMessages).toHaveBeenNthCalledWith(2, SERVER, {
                q: 'hola',
                author: 'frank',
                before: '2',
            });
            expect(result.current.state.results).toEqual([...page1, ...page2]);
            expect(result.current.state.hasMore).toBe(false);
        });

        it('sets loadMoreError on failure and preserves existing results', async () => {
            const service = fakeService({
                searchMessages: vi.fn()
                    .mockResolvedValueOnce({ data: [msg('1')], hasMore: true })
                    .mockRejectedValueOnce(new Error('network error')),
            });
            const { result } = renderHook(() => useSearchMessages(SERVER, service));

            await act(async () => { await result.current.search('hola'); });
            await act(async () => { await result.current.loadMore(); });

            expect(result.current.state.loadMoreError).toBe(true);
            expect(result.current.state.loadingMore).toBe(false);
            expect(result.current.state.results).toHaveLength(1);
        });

        it('does nothing when hasMore is false', async () => {
            const service = fakeService({
                searchMessages: vi.fn().mockResolvedValue({ data: [msg('1')], hasMore: false }),
            });
            const { result } = renderHook(() => useSearchMessages(SERVER, service));

            await act(async () => { await result.current.search('hola'); });
            await act(async () => { await result.current.loadMore(); });

            expect(service.searchMessages).toHaveBeenCalledTimes(1);
        });
    });

    it('clear resets state to idle', async () => {
        const service = fakeService({
            searchMessages: vi.fn().mockResolvedValue({ data: [msg('1')], hasMore: true }),
        });
        const { result } = renderHook(() => useSearchMessages(SERVER, service));

        await act(async () => { await result.current.search('hola', 'frank'); });
        act(() => { result.current.clear(); });

        expect(result.current.state).toEqual(idle);
    });
});
