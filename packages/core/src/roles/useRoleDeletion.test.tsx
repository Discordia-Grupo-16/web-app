// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '@discordia/api';
import { ADMINISTRATOR, MANAGE_ROLES, NONE } from '../permissions/permissions';
import { ROLE_DELETION_TEXTS } from './texts';
import type { RoleDeletionActor, RoleDeletionSource } from './types';
import { useRoleDeletion } from './useRoleDeletion';

const SERVER = 'srv';

const role = (id: string, position: number, permissions = NONE, isDefault = false): Role => ({
    id,
    server_id: SERVER,
    name: id,
    is_default: isDefault,
    permissions,
    permission_names: [],
    position,
    created_at: '2026-10-01T00:00:00Z',
});

const mine = role('mine', 5, MANAGE_ROLES);
const x = role('X', 2);
const everyone = role('everyone', 0, NONE, true);
const actor: RoleDeletionActor = { isOwner: false, permissions: MANAGE_ROLES, roles: [mine] };

const httpError = (status: number, detail?: string) => ({
    isAxiosError: true,
    response: { status, data: detail ? { detail } : {} },
});
const networkError = { isAxiosError: true, response: undefined };

const fakeSource = (overrides: Partial<RoleDeletionSource> = {}): RoleDeletionSource => ({
    deleteRole: vi.fn(async () => undefined),
    listRoles: vi.fn(async () => [mine, everyone]),
    ...overrides,
});

const render = (source: RoleDeletionSource, roles: Role[] = [mine, x, everyone], who = actor) => {
    const onDeleted = vi.fn();
    const onRolesReloaded = vi.fn();
    const onServerGone = vi.fn();
    const hook = renderHook(
        (props: { roles: Role[] }) =>
            useRoleDeletion({
                source,
                serverId: SERVER,
                actor: who,
                roles: props.roles,
                onDeleted,
                onRolesReloaded,
                onServerGone,
            }),
        { initialProps: { roles } },
    );
    return { ...hook, onDeleted, onRolesReloaded, onServerGone };
};

describe('useRoleDeletion', () => {
    it('blocks the default role without asking to confirm nor deleting', () => {
        const source = fakeSource();
        const { result } = render(source);

        act(() => result.current.request(everyone));

        expect(result.current.state).toEqual({ stage: 'blocked', role: everyone, blocker: 'default-role' });
        expect(source.deleteRole).not.toHaveBeenCalled();
    });

    it('blocks the only source of ADMINISTRATOR of whoever deletes', () => {
        const admin = role('admin', 3, ADMINISTRATOR);
        const { result } = render(fakeSource(), [mine, admin], { ...actor, roles: [mine, admin] });

        act(() => result.current.request(admin));

        expect(result.current.state).toMatchObject({ stage: 'blocked', blocker: 'sole-admin' });
    });

    it('asks to confirm, and cancelling changes nothing', () => {
        const source = fakeSource();
        const { result } = render(source);

        act(() => result.current.request(x));
        expect(result.current.state).toEqual({ stage: 'confirming', role: x, deleting: false, error: null });

        act(() => result.current.close());

        expect(result.current.state).toEqual({ stage: 'idle' });
        expect(source.deleteRole).not.toHaveBeenCalled();
    });

    it('shows that it is deleting and then tells the app the role is gone', async () => {
        let finish: () => void = () => undefined;
        const source = fakeSource({ deleteRole: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))) });
        const { result, onDeleted } = render(source);
        act(() => result.current.request(x));

        let pending: Promise<void> = Promise.resolve();
        act(() => {
            pending = result.current.confirm();
        });
        expect(result.current.state).toMatchObject({ stage: 'confirming', deleting: true });

        await act(async () => {
            finish();
            await pending;
        });

        expect(source.deleteRole).toHaveBeenCalledWith(SERVER, 'X');
        expect(onDeleted).toHaveBeenCalledWith('X');
        expect(result.current.state).toEqual({ stage: 'idle' });
    });

    it('takes a 404 as done when the server is still there', async () => {
        const source = fakeSource({ deleteRole: vi.fn(async () => Promise.reject(httpError(404))) });
        const { result, onDeleted } = render(source);
        act(() => result.current.request(x));

        await act(() => result.current.confirm());

        expect(onDeleted).toHaveBeenCalledWith('X');
        expect(result.current.state).toEqual({ stage: 'idle' });
    });

    it('says the server no longer exists when the list answers 404, and closing leaves it', async () => {
        const source = fakeSource({
            deleteRole: vi.fn(async () => Promise.reject(httpError(404))),
            listRoles: vi.fn(async () => Promise.reject(httpError(404))),
        });
        const { result, onDeleted, onServerGone } = render(source);
        act(() => result.current.request(x));

        await act(() => result.current.confirm());

        expect(result.current.state).toMatchObject({ stage: 'confirming', deleting: false, error: { kind: 'server-gone' } });
        expect(onDeleted).not.toHaveBeenCalled();

        act(() => result.current.close());

        expect(onServerGone).toHaveBeenCalled();
        expect(result.current.state).toEqual({ stage: 'idle' });
    });

    it('closes quietly when the list answers 403: whoever deletes is no longer a member', async () => {
        const source = fakeSource({
            deleteRole: vi.fn(async () => Promise.reject(httpError(404))),
            listRoles: vi.fn(async () => Promise.reject(httpError(403))),
        });
        const { result, onDeleted } = render(source);
        act(() => result.current.request(x));

        await act(() => result.current.confirm());

        expect(result.current.state).toEqual({ stage: 'idle' });
        expect(onDeleted).not.toHaveBeenCalled();
    });

    it.each([403, 409])('shows the reason of a %s and hands the real list to the app', async (status) => {
        const reloaded = [mine, x, everyone];
        const source = fakeSource({
            deleteRole: vi.fn(async () => Promise.reject(httpError(status, 'Es el rol por defecto'))),
            listRoles: vi.fn(async () => reloaded),
        });
        const { result, onRolesReloaded } = render(source);
        act(() => result.current.request(x));

        await act(() => result.current.confirm());

        expect(result.current.state).toMatchObject({
            stage: 'confirming',
            deleting: false,
            error: { kind: 'rejected', message: 'Es el rol por defecto' },
        });
        expect(onRolesReloaded).toHaveBeenCalledWith(reloaded);
    });

    it('uses the fallback text when a rejection comes without a reason', async () => {
        const source = fakeSource({ deleteRole: vi.fn(async () => Promise.reject(httpError(403))) });
        const { result } = render(source);
        act(() => result.current.request(x));

        await act(() => result.current.confirm());

        expect(result.current.state).toMatchObject({
            error: { kind: 'rejected', message: ROLE_DELETION_TEXTS.rejectedFallback },
        });
    });

    it('offers to retry a lost connection, and a 404 on the retry is done', async () => {
        const deleteRole = vi
            .fn()
            .mockRejectedValueOnce(networkError)
            .mockRejectedValueOnce(httpError(404));
        const source = fakeSource({ deleteRole });
        const { result, onDeleted } = render(source);
        act(() => result.current.request(x));

        await act(() => result.current.confirm());
        expect(result.current.state).toMatchObject({ error: { kind: 'network' } });

        await act(async () => {
            result.current.retry();
        });

        await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('X'));
        expect(deleteRole).toHaveBeenCalledTimes(2);
        expect(result.current.state).toEqual({ stage: 'idle' });
    });

    it('says the service could not complete it', async () => {
        const source = fakeSource({ deleteRole: vi.fn(async () => Promise.reject(httpError(503))) });
        const { result } = render(source);
        act(() => result.current.request(x));

        await act(() => result.current.confirm());

        expect(result.current.state).toMatchObject({ error: { kind: 'service' } });
    });

    it('goes back to idle when the role leaves the list while confirming', () => {
        const { result, rerender } = render(fakeSource());
        act(() => result.current.request(x));

        rerender({ roles: [mine, everyone] });

        expect(result.current.state).toEqual({ stage: 'idle' });
    });
});
