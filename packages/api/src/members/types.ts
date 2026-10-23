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
}

/** A ban of a server, as `community` returns it. No names: they belong to `identity`. */
export interface ServerBan {
    user_id: string;
    banned_by: string;
    reason: string | null;
    created_at: string;
}
