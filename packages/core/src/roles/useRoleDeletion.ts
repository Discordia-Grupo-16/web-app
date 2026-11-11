import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@discordia/api';
import { roleDeletionBlocker } from './deletion';
import { classifyRoleDeletionError } from './errors';
import { ROLE_DELETION_TEXTS } from './texts';
import type { RoleDeletion, RoleDeletionError, RoleDeletionState, UseRoleDeletionOptions } from './types';

// What reading the role list again says about the server.
type Reread = { kind: 'ok'; roles: Role[] } | { kind: 'server-gone' } | { kind: 'not-member' } | { kind: 'failed' };

const reread = async (source: UseRoleDeletionOptions['source'], serverId: string): Promise<Reread> => {
    try {
        return { kind: 'ok', roles: await source.listRoles(serverId) };
    } catch (error) {
        const status = (error as { response?: { status?: number } } | null)?.response?.status;
        if (status === 404) return { kind: 'server-gone' };
        if (status === 403) return { kind: 'not-member' };
        return { kind: 'failed' };
    }
};

const detailOf = (error: unknown): string | undefined => {
    const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data?.detail;
    return typeof detail === 'string' && detail ? detail : undefined;
};

const IDLE: RoleDeletionState = { stage: 'idle' };

/**
 * "Eliminar" on a role, from the confirmation to the result (SCRUM-64, Eliminar rol).
 *
 * The default role and the only source of ADMINISTRATOR of whoever deletes are refused before the
 * confirmation. A role that no longer exists is not an error: whatever deleted it first, it is gone.
 * After a rejection or a failure the list is read again and handed to the app, because the list it
 * shows may be the reason.
 */
export const useRoleDeletion = ({
    source,
    serverId,
    actor,
    roles,
    onDeleted,
    onRolesReloaded,
    onServerGone,
}: UseRoleDeletionOptions): RoleDeletion => {
    const [state, setState] = useState<RoleDeletionState>(IDLE);
    const stateRef = useRef(state);
    stateRef.current = state;

    const request = useCallback(
        (role: Role) => {
            if (!serverId) return;
            const blocker = roleDeletionBlocker(role, actor);
            setState(
                blocker
                    ? { stage: 'blocked', role, blocker }
                    : { stage: 'confirming', role, deleting: false, error: null },
            );
        },
        [serverId, actor],
    );

    const fail = useCallback((role: Role, error: RoleDeletionError) => {
        setState({ stage: 'confirming', role, deleting: false, error });
    }, []);

    const confirm = useCallback(async () => {
        const current = stateRef.current;
        if (!serverId || current.stage !== 'confirming' || current.deleting) return;
        const { role } = current;
        setState({ stage: 'confirming', role, deleting: true, error: null });

        try {
            await source.deleteRole(serverId, role.id);
            onDeleted(role.id);
            setState(IDLE);
            return;
        } catch (error) {
            const failure = classifyRoleDeletionError(error);

            if (failure === 'gone') {
                // The role or the server no longer exists: the list tells which.
                const after = await reread(source, serverId);
                if (after.kind === 'server-gone') {
                    fail(role, { kind: 'server-gone' });
                } else if (after.kind === 'ok') {
                    onDeleted(role.id);
                    setState(IDLE);
                } else {
                    // Not a member any more: the app drops the server with the `servers` notice.
                    setState(IDLE);
                }
                return;
            }

            fail(
                role,
                failure === 'rejected'
                    ? { kind: 'rejected', message: detailOf(error) ?? ROLE_DELETION_TEXTS.rejectedFallback }
                    : { kind: failure },
            );
            const after = await reread(source, serverId);
            if (after.kind === 'ok') {
                onRolesReloaded(after.roles);
            } else if (after.kind === 'server-gone') {
                fail(role, { kind: 'server-gone' });
            } else if (after.kind === 'not-member') {
                setState(IDLE);
            }
        }
    }, [serverId, source, onDeleted, onRolesReloaded, fail]);

    const retry = useCallback(() => {
        void confirm();
    }, [confirm]);

    const close = useCallback(() => {
        const current = stateRef.current;
        setState(IDLE);
        if (current.stage === 'confirming' && current.error?.kind === 'server-gone') onServerGone();
    }, [onServerGone]);

    // Someone else deleted the role while this one was open: there is nothing left to confirm.
    useEffect(() => {
        if (state.stage === 'idle') return;
        if (state.stage === 'confirming' && state.deleting) return;
        if (!roles.some(r => r.id === state.role.id)) setState(IDLE);
    }, [roles, state]);

    return { state, request, confirm, retry, close };
};
