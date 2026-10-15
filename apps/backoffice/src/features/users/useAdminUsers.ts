import { useEffect, useState } from 'react';
import { isCancel } from 'axios';
import type { AdminUser, AdminUserStatus, PaginationMeta } from '@discordia/api';
import { adminUserService } from '@/shared/api';

export const PAGE_SIZE = 20;

interface Params {
    search: string;
    status: AdminUserStatus | undefined;
    offset: number;
}

// The outcome is stored with the key of the request that produced it. "Loading" is then derived
// (the stored key is not the current one) instead of set from inside the effect.
interface Outcome {
    key: string;
    users: AdminUser[];
    meta: PaginationMeta | null;
    error: unknown;
}

export const useAdminUsers = ({ search, status, offset }: Params) => {
    const [reloads, setReloads] = useState(0);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    const key = JSON.stringify([search, status, offset, reloads]);

    useEffect(() => {
        // One controller per request: a slow response of an old search must never overwrite the new one.
        const controller = new AbortController();

        adminUserService
            .listUsers(
                { ...(search && { search }), ...(status && { status }), limit: PAGE_SIZE, offset },
                controller.signal,
            )
            .then(({ data, meta }) => setOutcome({ key, users: data, meta, error: null }))
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
