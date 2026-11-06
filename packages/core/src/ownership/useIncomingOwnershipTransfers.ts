import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OwnershipTransfer } from '@discordia/api';
import { UNAVAILABLE_USER_NAME } from '../chat/authorName';
import { usePublicProfiles } from '../profiles/usePublicProfiles';
import { classifyOwnershipError } from './errors';
import { visibleIncoming } from './incoming';
import { OWNERSHIP_TEXTS } from './texts';
import type {
    IncomingOwnershipTransfers,
    IncomingTransferView,
    OwnershipError,
    OwnershipTransferSource,
    UseIncomingOwnershipTransfersOptions,
} from './types';

type Action = 'accept' | 'reject';

interface BannerState {
    busy: IncomingTransferView['busy'];
    error: OwnershipError | null;
    stale: boolean;
}

const IDLE: BannerState = { busy: null, error: null, stale: false };

// After a 404 on accept the transfer is gone either way: asking for the server tells whether the
// server went with it.
const acceptGone = async (source: OwnershipTransferSource, serverId: string): Promise<OwnershipError> => {
    try {
        await source.getServer(serverId);
        return { kind: 'unavailable' };
    } catch {
        return { kind: 'server-gone' };
    }
};

/**
 * The transfers waiting for the recipient's answer (SCRUM-35), one banner per server. A banner whose
 * transfer is no longer available, or whose server is gone, stays with its message until it is
 * closed, so the recipient gets to read why.
 */
export const useIncomingOwnershipTransfers = ({
    source,
    enabled = true,
}: UseIncomingOwnershipTransfersOptions): IncomingOwnershipTransfers => {
    const [pending, setPending] = useState<OwnershipTransfer[]>([]);
    // The transfers of stale banners, kept after a reading no longer brings them.
    const [stale, setStale] = useState<ReadonlyMap<string, OwnershipTransfer>>(new Map());
    const [banners, setBanners] = useState<ReadonlyMap<string, BannerState>>(new Map());
    const lastFailed = useRef(new Map<string, Action>());

    const setBanner = useCallback((serverId: string, state: Partial<BannerState>) => {
        setBanners((previous) => new Map(previous).set(serverId, { ...(previous.get(serverId) ?? IDLE), ...state }));
    }, []);

    const load = useCallback(async () => {
        if (!enabled) {
            setPending([]);
            return;
        }
        try {
            const [mine, servers] = await Promise.all([source.listMyTransfers(), source.getServers()]);
            setPending(visibleIncoming(mine, new Set(servers.map((server) => server.id))));
        } catch {
            // A failed reading keeps what is shown; the next notice or the backup polling asks again.
        }
    }, [source, enabled]);

    const reload = useCallback(() => {
        void load();
    }, [load]);

    useEffect(() => {
        void load();
    }, [load]);

    const act = useCallback(
        async (serverId: string, action: Action): Promise<void> => {
            setBanner(serverId, { busy: action === 'accept' ? 'accepting' : 'rejecting', error: null });
            try {
                if (action === 'accept') await source.acceptTransfer(serverId);
                else await source.rejectTransfer(serverId);
                lastFailed.current.delete(serverId);
                setBanner(serverId, IDLE);
                await load();
            } catch (err) {
                const failure = classifyOwnershipError(err, action);
                if (failure === 'network' || failure === 'service') {
                    lastFailed.current.set(serverId, action);
                    setBanner(serverId, { busy: null, error: { kind: failure } });
                    return;
                }
                const error: OwnershipError =
                    failure === 'gone-or-unavailable'
                        ? await acceptGone(source, serverId)
                        : failure === 'server-gone'
                          ? { kind: 'server-gone' }
                          : { kind: 'unavailable' };
                const transfer = pending.find((t) => t.server_id === serverId);
                if (transfer) setStale((previous) => new Map(previous).set(serverId, transfer));
                lastFailed.current.delete(serverId);
                setBanner(serverId, { busy: null, error, stale: true });
            }
        },
        [source, load, setBanner, pending],
    );

    const accept = useCallback((serverId: string) => act(serverId, 'accept'), [act]);
    const reject = useCallback((serverId: string) => act(serverId, 'reject'), [act]);

    const retry = useCallback(
        (serverId: string) => {
            const action = lastFailed.current.get(serverId);
            if (action) void act(serverId, action);
        },
        [act],
    );

    const dismiss = useCallback((serverId: string) => {
        // A closed banner is not shown again from an older reading: the transfer is no longer actionable.
        setPending((previous) => previous.filter((transfer) => transfer.server_id !== serverId));
        setStale((previous) => {
            const next = new Map(previous);
            next.delete(serverId);
            return next;
        });
        setBanners((previous) => {
            const next = new Map(previous);
            next.delete(serverId);
            return next;
        });
        lastFailed.current.delete(serverId);
        void load();
    }, [load]);

    const shown = useMemo(() => {
        const live = pending.filter((transfer) => !stale.has(transfer.server_id));
        return [...live, ...stale.values()];
    }, [pending, stale]);

    const profiles = usePublicProfiles(shown.map((transfer) => transfer.from_user_id));

    const transfers = useMemo(
        () =>
            shown.map((transfer): IncomingTransferView => {
                const profile = profiles.get(transfer.from_user_id);
                const banner = banners.get(transfer.server_id) ?? IDLE;
                return {
                    serverId: transfer.server_id,
                    serverName: transfer.server_name,
                    fromUserId: transfer.from_user_id,
                    fromName:
                        profile === undefined ? OWNERSHIP_TEXTS.loadingName : (profile?.name ?? UNAVAILABLE_USER_NAME),
                    fromNameLoading: profile === undefined,
                    busy: banner.busy,
                    error: banner.error,
                    stale: banner.stale,
                };
            }),
        [shown, profiles, banners],
    );

    return { transfers, reload, accept, reject, retry, dismiss };
};
