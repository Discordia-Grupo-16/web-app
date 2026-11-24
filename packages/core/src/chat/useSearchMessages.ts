import { useCallback, useRef, useState } from 'react';
import type { MessageDto, SearchMessagesParams } from '@discordia/api';

export interface SearchMessagesService {
    searchMessages(serverId: string, params: SearchMessagesParams): Promise<{ data: MessageDto[]; hasMore: boolean }>;
}

export interface SearchMessagesState {
    results: MessageDto[];
    loading: boolean;
    error: boolean;
    hasMore: boolean;
    loadingMore: boolean;
    loadMoreError: boolean;
    /** The query that produced the current results, or empty if not searched yet. */
    activeQuery: string;
    activeAuthor: string;
}

const idle: SearchMessagesState = {
    results: [],
    loading: false,
    error: false,
    hasMore: false,
    loadingMore: false,
    loadMoreError: false,
    activeQuery: '',
    activeAuthor: '',
};

export function useSearchMessages(serverId: string, service: SearchMessagesService) {
    const [state, setState] = useState<SearchMessagesState>(idle);
    // Tracks the cursor for the current page so loadMore knows where to start.
    const lastIdRef = useRef<string | undefined>(undefined);
    // Refs mirror hasMore/loadingMore for synchronous guards in async callbacks.
    const hasMoreRef = useRef(false);
    const loadingMoreRef = useRef(false);

    const search = useCallback(async (q: string, author = '') => {
        setState({ ...idle, loading: true, activeQuery: q, activeAuthor: author });
        lastIdRef.current = undefined;
        hasMoreRef.current = false;
        loadingMoreRef.current = false;
        try {
            const res = await service.searchMessages(serverId, { q: q || undefined, author: author || undefined });
            lastIdRef.current = res.data.at(-1)?.messageId;
            hasMoreRef.current = res.hasMore;
            setState(s => ({ ...s, loading: false, results: res.data, hasMore: res.hasMore }));
        } catch {
            setState(s => ({ ...s, loading: false, error: true }));
        }
    }, [serverId, service]);

    const loadMore = useCallback(async () => {
        if (!hasMoreRef.current || loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setState(s => ({ ...s, loadingMore: true, loadMoreError: false }));
        try {
            const res = await service.searchMessages(serverId, {
                q: state.activeQuery || undefined,
                author: state.activeAuthor || undefined,
                before: lastIdRef.current,
            });
            lastIdRef.current = res.data.at(-1)?.messageId ?? lastIdRef.current;
            hasMoreRef.current = res.hasMore;
            loadingMoreRef.current = false;
            setState(s => ({
                ...s,
                loadingMore: false,
                results: [...s.results, ...res.data],
                hasMore: res.hasMore,
            }));
        } catch {
            loadingMoreRef.current = false;
            setState(s => ({ ...s, loadingMore: false, loadMoreError: true }));
        }
    }, [serverId, service, state.activeQuery, state.activeAuthor]);

    const clear = useCallback(() => {
        setState(idle);
        lastIdRef.current = undefined;
        hasMoreRef.current = false;
        loadingMoreRef.current = false;
    }, []);

    return { state, search, loadMore, clear };
}
