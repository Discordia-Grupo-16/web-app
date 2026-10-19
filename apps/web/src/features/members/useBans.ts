import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerBan } from '@discordia/api';
import { membersService } from '@/shared/api';
import { usePolling } from '@/shared/hooks/usePolling';

/**
 * The bans of a server, for the bans section (SCRUM-70).
 *
 * `enabled` is whether the caller has BAN_MEMBERS. Without it the backend
 * answers 403, so the hook does not ask at all and returns an empty list.
 */
export const useBans = (serverId: string | undefined, enabled: boolean) => {
    const [bans, setBans] = useState<ServerBan[]>([]);
    const [loading, setLoading] = useState(false);

    // What the list belongs to right now. The initial load is protected by `isMounted`, but
    // `reload` and the poll are not tied to an effect: their answer is compared against this
    // when it arrives, so switching servers with one in flight does not paint the old list.
    const current = useRef({ serverId, enabled });
    useEffect(() => {
        current.current = { serverId, enabled };
    }, [serverId, enabled]);

    useEffect(() => {
        let isMounted = true;

        const loadBans = async () => {
            if (!serverId || !enabled) {
                setBans([]);
                return;
            }

            setLoading(true);
            try {
                const list = await membersService.listBans(serverId);
                if (isMounted) setBans(list);
            } catch (err) {
                // A server that is gone is handled by whoever loads the server.
                console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadBans();

        return () => {
            isMounted = false;
        };
    }, [serverId, enabled]);

    /**
     * Asks for the list again without flagging `loading`: the panel hides every
     * section while something loads, and a reload after a ban must not blink it.
     */
    const reload = useCallback(() => {
        if (!serverId || !enabled) return;
        membersService.listBans(serverId)
            .then(list => {
                const now = current.current;
                if (now.serverId === serverId && now.enabled) setBans(list);
            })
            .catch(console.error);
    }, [serverId, enabled]);

    // Nothing about bans is pushed over the socket: a ban made by another
    // moderator shows up with the poll.
    usePolling(reload, !!serverId && enabled);

    /**
     * Drops a revoked ban from the list. The DELETE answers 204 without a body,
     * and the row has to go the moment it is confirmed, not with the next poll.
     */
    const removeBan = useCallback(
        (userId: string) => setBans(prev => prev.filter(ban => ban.user_id !== userId)),
        [],
    );

    return { bans, loading, removeBan, reload };
};
