import { useEffect, useRef, useState } from 'react';
import { isCancel } from 'axios';
import type { AdminServer, PaginationMeta } from '@discordia/api';
import { adminServerService } from '@/shared/api';

export const PAGE_SIZE = 20;

interface Params {
    search: string;
    offset: number;
    // Called when a load comes back empty past the first page (the rows of that page are gone, e.g.
    // after an action filtered the last one out). Receives the offset of the previous page.
    onPastEnd?: (previousOffset: number) => void;
}

// The outcome is stored with the key of the request that produced it. "Loading" is then derived
// (the stored key is not the current one) instead of set from inside the effect.
interface Outcome {
    key: string;
    servers: AdminServer[];
    meta: PaginationMeta | null;
    error: unknown;
}

export const useAdminServers = ({ search, offset, onPastEnd }: Params) => {
    const [reloads, setReloads] = useState(0);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    // The effect must not restart (and refetch) when the caller passes a new closure each render.
    const onPastEndRef = useRef(onPastEnd);
    useEffect(() => {
        onPastEndRef.current = onPastEnd;
    });

    const key = JSON.stringify([search, offset, reloads]);

    useEffect(() => {
        // One controller per request: a slow response of an old search must never overwrite the new one.
        const controller = new AbortController();

        adminServerService
            .listServers(
                { ...(search && { search }), limit: PAGE_SIZE, offset },
                controller.signal,
            )
            .then(({ data, meta }) => {
                setOutcome({ key, servers: data, meta, error: null });
                if (data.length === 0 && offset > 0) onPastEndRef.current?.(Math.max(0, offset - PAGE_SIZE));
            })
            .catch((err: unknown) => {
                if (isCancel(err)) return;
                setOutcome({ key, servers: [], meta: null, error: err });
            });

        return () => controller.abort();
    }, [key, search, offset]);

    const current = outcome?.key === key ? outcome : null;

    return {
        servers: current?.servers ?? [],
        meta: current?.meta ?? null,
        isLoading: current === null,
        error: current?.error ?? null,
        reload: () => setReloads((n) => n + 1),
    };
};