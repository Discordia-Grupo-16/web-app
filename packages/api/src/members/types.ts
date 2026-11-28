import type { Role } from '../roles/types';

/**
 * A member of a server, as `community` returns them.
 *
 * There is no name or avatar: those belong to `identity` and are resolved
 * separately through the public profiles. And no membership row id, because
 * every endpoint that acts on a member is addressed by `user_id`.
 */
export interface ServerMember {
    user_id: string;
    joined_at: string;
    /** The roles the member has, ordered by position: lowest in the hierarchy first. */
    roles: Role[];
    /**
     * Until when the member is muted (SCRUM-71), in UTC with `Z`. `null` if
     * they are not, or if the mute already ended. Compare it as a date.
     */
    muted_until: string | null;
}

/** A ban of a server, as `community` returns it. No names: they belong to `identity`. */
export interface ServerBan {
    user_id: string;
    banned_by: string;
    reason: string | null;
    created_at: string;
}

/**
 * What the backend answers after muting a member (SCRUM-71). `muted_until` is
 * the instant the server calculated, so the client never builds it from its
 * own clock.
 */
export interface ServerMute {
    user_id: string;
    muted_until: string; // ISO-8601 in UTC with Z
    muted_by: string;
}
