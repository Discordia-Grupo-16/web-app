import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OwnershipTransfer } from '@discordia/api';
import { UNAVAILABLE_USER_NAME } from '../chat/authorName';
import { usePublicProfiles } from '../profiles/usePublicProfiles';
import { classifyOwnershipError } from './errors';
import { toOutgoingView } from './outgoing';
import { OWNERSHIP_TEXTS } from './texts';
import type {
    DismissedRejectionStore,
    OutgoingOwnershipTransfer,
    OutgoingTransferView,
    OwnershipError,
    OwnershipFailure,
    OwnershipTransferSource,
    UseOutgoingOwnershipTransferOptions,
} from './types';

// The error without the names, which are resolved on render from the public profiles.
type PendingError = Exclude<OwnershipError, { kind: 'already-pending' }> | { kind: 'already-pending'; toUserId: string };

type FailedAction = { action: 'propose'; toUserId: string } | { action: 'cancel' };

// The failures the classifier leaves to the hook never reach the user as they are.
const toError = (failure: OwnershipFailure): PendingError => {
    switch (failure) {
        case 'conflict':
        case 'gone-or-unavailable':
            return { kind: 'service' };
        default:
            return { kind: failure };
    }
};

// The last transfer, or null when there is nothing the owner can see: a 403 means the viewer is not
// the owner any more and a 404 that the server never had one.
const readLatest = async (source: OwnershipTransferSource, serverId: string): Promise<OwnershipTransfer | null> => {
    try {
        return await source.getServerTransfer(serverId);
    } catch {
        return null;
    }
};

// The rejection closed on this device, or null when the device cannot say: then it shows again,
// which is better than hiding one the owner never saw.
const readDismissed = async (store: DismissedRejectionStore, serverId: string): Promise<string | null> => {
    try {
        return await store.get(serverId);
    } catch {
        return null;
    }
};

/**
 * The owner's transfer of the open server (SCRUM-35). Only the owner asks: for anyone else the view
 * is `none` and nothing is requested.
 */
export const useOutgoingOwnershipTransfer = ({
    source,
    dismissedRejections,
    serverId,
    isOwner,
}: UseOutgoingOwnershipTransferOptions): OutgoingOwnershipTransfer => {
    const [latest, setLatest] = useState<OwnershipTransfer | null>(null);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState<OutgoingOwnershipTransfer['busy']>(null);
    const [error, setError] = useState<PendingError | null>(null);
    const [dismissedRejectionAt, setDismissedRejectionAt] = useState<string | null>(null);
    const lastFailed = useRef<FailedAction | null>(null);
    const active = Boolean(serverId) && isOwner;

    const load = useCallback(async () => {
        if (!serverId || !isOwner) {
            setLatest(null);
            return null;
        }
        const current = await readLatest(source, serverId);
        setLatest(current);
        return current;
    }, [source, serverId, isOwner]);

    const reload = useCallback(() => {
        void load();
    }, [load]);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        if (!serverId || !isOwner) {
            setLatest(null);
            return;
        }
        setLoading(true);
        // Both before showing anything, so a rejection already closed here never flashes.
        void Promise.all([readLatest(source, serverId), readDismissed(dismissedRejections, serverId)]).then(
            ([current, dismissed]) => {
                if (cancelled) return;
                setDismissedRejectionAt(dismissed);
                setLatest(current);
                setLoading(false);
            },
        );
        return () => {
            cancelled = true;
        };
    }, [source, dismissedRejections, serverId, isOwner]);

    const propose = useCallback(
        async (toUserId: string): Promise<boolean> => {
            if (!serverId) return false;
            setBusy('proposing');
            setError(null);
            try {
                setLatest(await source.proposeTransfer(serverId, toUserId));
                lastFailed.current = null;
                return true;
            } catch (err) {
                const failure = classifyOwnershipError(err, 'propose');
                if (failure === 'conflict') {
                    // Another tab or a retry got there first: what matters is what is pending now.
                    const current = await load();
                    if (current?.status === 'pending') {
                        if (current.to_user_id === toUserId) {
                            lastFailed.current = null;
                            return true;
                        }
                        setError({ kind: 'already-pending', toUserId: current.to_user_id });
                        return false;
                    }
                }
                if (failure === 'not-member' || failure === 'network') await load();
                lastFailed.current = { action: 'propose', toUserId };
                setError(toError(failure));
                return false;
            } finally {
                setBusy(null);
            }
        },
        [source, serverId, load],
    );

    const cancel = useCallback(async (): Promise<void> => {
        if (!serverId) return;
        setBusy('cancelling');
        setError(null);
        try {
            await source.cancelTransfer(serverId);
            lastFailed.current = null;
            setLatest((previous) =>
                previous?.status === 'pending'
                    ? { ...previous, status: 'cancelled', resolved_at: new Date().toISOString() }
                    : previous,
            );
        } catch (err) {
            const failure = classifyOwnershipError(err, 'cancel');
            if (failure === 'network') await load();
            lastFailed.current = { action: 'cancel' };
            setError(toError(failure));
        } finally {
            setBusy(null);
        }
    }, [source, serverId, load]);

    const retry = useCallback(() => {
        const failed = lastFailed.current;
        if (!failed) return;
        if (failed.action === 'propose') void propose(failed.toUserId);
        else void cancel();
    }, [propose, cancel]);

    const dismissError = useCallback(() => setError(null), []);

    const dismissRejection = useCallback(() => {
        if (!serverId || latest?.status !== 'rejected') return;
        setDismissedRejectionAt(latest.created_at);
        // If the device cannot save it, it stays closed only until the next reload.
        void dismissedRejections.set(serverId, latest.created_at).catch(() => undefined);
    }, [dismissedRejections, serverId, latest]);

    const base = active ? toOutgoingView(latest, dismissedRejectionAt) : { kind: 'none' as const };
    const named = [base.toUserId, error?.kind === 'already-pending' ? error.toUserId : undefined].filter(
        (id): id is string => Boolean(id),
    );
    const profiles = usePublicProfiles(named);

    const nameOf = useCallback(
        (userId: string): { name: string; loading: boolean } => {
            const profile = profiles.get(userId);
            if (profile === undefined) return { name: OWNERSHIP_TEXTS.loadingName, loading: true };
            return { name: profile?.name ?? UNAVAILABLE_USER_NAME, loading: false };
        },
        [profiles],
    );

    const view = useMemo((): OutgoingTransferView => {
        if (base.kind === 'none' || !base.toUserId || !base.createdAt) return { kind: 'none' };
        const { name, loading: nameLoading } = nameOf(base.toUserId);
        return {
            kind: base.kind,
            toUserId: base.toUserId,
            toName: name,
            toNameLoading: nameLoading,
            createdAt: base.createdAt,
        };
    }, [base.kind, base.toUserId, base.createdAt, nameOf]);

    const shownError = useMemo((): OwnershipError | null => {
        if (error?.kind !== 'already-pending') return error;
        return { kind: 'already-pending', toUserId: error.toUserId, toName: nameOf(error.toUserId).name };
    }, [error, nameOf]);

    return {
        view,
        loading: active && loading,
        busy,
        error: shownError,
        reload,
        propose,
        cancel,
        retry,
        dismissError,
        dismissRejection,
    };
};
