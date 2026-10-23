import { useCallback, useEffect, useRef, useState } from 'react';
import type { ServerBan } from '@discordia/api';
import { membersService } from '@/shared/api';
import { useFocusedPolling } from '@/shared/hooks/useFocusedPolling';

/**
 * The bans of a server, for the bans section (SCRUM-70).
 *
 * `enabled` is whether the caller has BAN_MEMBERS. Without it the backend
 * answers 403, so the hook does not ask at all and returns an empty list.
 */
export const useBans = (serverId: string | undefined, enabled: boolean) => {
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [loading, setLoading] = useState(false);
  // Whether the last load failed. Without it a failure would read as "nobody is banned".
  const [error, setError] = useState(false);

  // What the list belongs to right now. The initial load is protected by `isMounted`, but
  // `reload` and the poll are not tied to an effect: their answer is compared against this
  // when it arrives, so switching servers with one in flight does not paint the old list.
  const current = useRef({ serverId, enabled });
  useEffect(() => {
    current.current = { serverId, enabled };
  }, [serverId, enabled]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      // Emptied before asking: if this load fails, the previous server's bans must not stay
      // on screen, where revoking one would hit this server and answer 204 doing nothing.
      setBans([]);
      setError(false);
      if (!serverId || !enabled) return;

      setLoading(true);
      try {
        const list = await membersService.listBans(serverId);
        if (isMounted) setBans(list);
      } catch (err) {
        console.error(err);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [serverId, enabled]);

  /**
   * Asks for the list again without flagging `loading`: the screen shows a
   * spinner while something loads, and a reload after a ban must not blink it.
   * A failed reload keeps the list it had, which is still this server's.
   */
  const reload = useCallback(() => {
    if (!serverId || !enabled) return;
    membersService
      .listBans(serverId)
      .then(list => {
        const now = current.current;
        if (now.serverId === serverId && now.enabled) {
          setBans(list);
          setError(false);
        }
      })
      .catch(console.error);
  }, [serverId, enabled]);

  // Nothing about bans is pushed over the socket: a ban made by another
  // moderator shows up with the poll. `reload` returns early without the bit,
  // since this poll has no `enabled` switch.
  useFocusedPolling(reload);

  /**
   * Drops a revoked ban from the list. The DELETE answers 204 without a body,
   * and the row has to go the moment it is confirmed, not with the next poll.
   */
  const removeBan = useCallback(
    (userId: string) => setBans(prev => prev.filter(ban => ban.user_id !== userId)),
    [],
  );

  return { bans, loading, error, removeBan, reload };
};
