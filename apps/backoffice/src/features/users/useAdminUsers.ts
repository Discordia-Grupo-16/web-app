import { useEffect, useRef, useState } from 'react';
import { isCancel } from 'axios';
import type { AdminUser, AdminUserStatus, PaginationMeta } from '@discordia/api';
import { adminUserService } from '@/shared/api';

export const PAGE_SIZE = 20;

interface Params {
    search: string;
    status: AdminUserStatus | undefined;
    offset: number;
    // Called when a load comes back empty past the first page (the rows of that page are gone, e.g.
    // after an action filtered the last one out). Receives the offset of the previous page.
    onPastEnd?: (previousOffset: number) => void;
}

// The outcome is stored with the key of the request that produced it. "Loading" is then derived
// (the stored key is not the current one) instead of set from inside the effect.
interface Outcome {
    key: string;
    users: AdminUser[];
    meta: PaginationMeta | null;
    error: unknown;
}

export const useAdminUsers = ({ search, status, offset, onPastEnd }: Params) => {
    const [reloads, setReloads] = useState(0);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    // The effect must not restart (and refetch) when the caller passes a new closure each render.
    const onPastEndRef = useRef(onPastEnd);
    useEffect(() => {
        onPastEndRef.current = onPastEnd;
    });

    const key = JSON.stringify([search, status, offset, reloads]);

    useEffect(() => {
        // One controller per request: a slow response of an old search must never overwrite the new one.
        const controller = new AbortController();

        adminUserService
            .listUsers(
                { ...(search && { search }), ...(status && { status }), limit: PAGE_SIZE, offset },
                controller.signal,
            )
            .then(({ data, meta }) => {
                setOutcome({ key, users: data, meta, error: null });
                if (data.length === 0 && offset > 0) onPastEndRef.current?.(Math.max(0, offset - PAGE_SIZE));
            })
            .catch((err: unknown) => {
                if (isCancel(err)) return;
                setOutcome({ key, users: [], meta: null, error: err });
            });

        return () => controller.abort();
    }, [key, search, status, offset]);

    const current = outcome?.key === key ? outcome : null;

    return {
        users: current?.users ?? [],
        meta: current?.meta ?? null,
        isLoading: current === null,
        error: current?.error ?? null,
        reload: () => setReloads((n) => n + 1),
    };
};
