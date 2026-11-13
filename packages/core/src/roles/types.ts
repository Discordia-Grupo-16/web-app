import type { Role } from '@discordia/api';

/** Why "Eliminar" shows a message instead of the confirmation. */
export type RoleDeletionBlocker = 'default-role' | 'sole-admin';

/** Who deletes, with what the app already has loaded. */
export interface RoleDeletionActor {
    isOwner: boolean;
    /** `my_permissions` of the server; NONE while it has not loaded. */
    permissions: number;
    /** The roles of whoever deletes, from their row in the member list. Empty while it has not loaded. */
    roles: readonly Role[];
}

/** What the classifier returns. `gone` is finished by the hook, which reads the list again. */
export type RoleDeletionFailure = 'rejected' | 'gone' | 'network' | 'service';

/** What the user sees. */
export type RoleDeletionError =
    /** 403 or 409: the backend's `detail`, or the fallback text when it did not come. */
    | { kind: 'rejected'; message: string }
    | { kind: 'server-gone' }
    | { kind: 'network' }
    | { kind: 'service' };

export type RoleDeletionState =
    | { stage: 'idle' }
    | { stage: 'blocked'; role: Role; blocker: RoleDeletionBlocker }
    | { stage: 'confirming'; role: Role; deleting: boolean; error: RoleDeletionError | null };

/** What the hook needs from the API. The app passes its `rolesService`. */
export interface RoleDeletionSource {
    deleteRole: (serverId: string, roleId: string) => Promise<void>;
    listRoles: (serverId: string) => Promise<Role[]>;
}

export interface UseRoleDeletionOptions {
    source: RoleDeletionSource;
    /** undefined outside a server: `request` does nothing. */
    serverId: string | undefined;
    actor: RoleDeletionActor;
    /** The list the app shows. If the role in progress leaves it, the hook goes back to `idle`. */
    roles: readonly Role[];
    /** The role no longer exists: 204, or 404 with the server alive. */
    onDeleted: (roleId: string) => void;
    /** The list read again after a rejection or a failure: it is the real state. */
    onRolesReloaded: (roles: Role[]) => void;
    /** "Cerrar" on "El servidor ya no existe". */
    onServerGone: () => void;
}

export interface RoleDeletion {
    state: RoleDeletionState;
    /** "Eliminar" on a role: opens the confirmation or the blocking message. */
    request: (role: Role) => void;
    confirm: () => Promise<void>;
    /** Repeats the DELETE that failed because of the network or the service. */
    retry: () => void;
    /** Cancel or close. On `server-gone` it calls `onServerGone`. */
    close: () => void;
}
