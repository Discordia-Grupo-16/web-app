// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OwnershipTransfer, PublicProfiles } from '@discordia/api';
import { PublicProfilesProvider, type PublicProfileSource } from '../profiles/PublicProfilesProvider';
import type { OwnershipTransferSource } from './types';
import { useOutgoingOwnershipTransfer } from './useOutgoingOwnershipTransfer';

const SERVER = 'srv';
const BETO = 'beto';
const CARO = 'caro';

const transfer = (overrides: Partial<OwnershipTransfer> = {}): OwnershipTransfer => ({
    server_id: SERVER,
    server_name: 'Grupo 16',
    from_user_id: 'ana',
    to_user_id: BETO,
    status: 'pending',
    created_at: '2026-11-05T10:00:00Z',
    resolved_at: null,
    ...overrides,
});

const httpError = (status: number) => ({ isAxiosError: true, response: { status } });
const networkError = { isAxiosError: true, response: undefined };

const fakeSource = (overrides: Partial<OwnershipTransferSource> = {}): OwnershipTransferSource => ({
    getServerTransfer: vi.fn(async () => Promise.reject(httpError(404))),
    proposeTransfer: vi.fn(async (_serverId: string, toUserId: string) => transfer({ to_user_id: toUserId })),
    cancelTransfer: vi.fn(async () => undefined),
    acceptTransfer: vi.fn(async () => undefined),
    rejectTransfer: vi.fn(async () => undefined),
    listMyTransfers: vi.fn(async () => []),
    getServer: vi.fn(async () => ({})),
    getServers: vi.fn(async () => []),
    ...overrides,
});

const profiles: PublicProfileSource = {
    getPublicProfiles: async (ids): Promise<PublicProfiles> =>
        new Map(
            ids.map((id) => [id, { id, name: id === BETO ? 'Beto' : 'Caro', avatarUrl: null, bio: null }] as const),
        ),
    peekPublicProfile: () => undefined,
};

const wrapper = ({ children }: { children: ReactNode }) => (
    <PublicProfilesProvider source={profiles}>{children}</PublicProfilesProvider>
);

const render = (source: OwnershipTransferSource, isOwner = true) =>
    renderHook((props: { isOwner: boolean }) => useOutgoingOwnershipTransfer({ source, serverId: SERVER, isOwner: props.isOwner }), {
        wrapper,
        initialProps: { isOwner },
    });

describe('useOutgoingOwnershipTransfer', () => {
    it('shows the proposed transfer with the recipient name, without reading it again', async () => {
        let resolvePropose: (value: OwnershipTransfer) => void = () => undefined;
        const source = fakeSource({
            proposeTransfer: vi.fn(() => new Promise<OwnershipTransfer>((resolve) => (resolvePropose = resolve))),
        });
        const { result } = render(source);
        await waitFor(() => expect(result.current.loading).toBe(false));

        let proposed: Promise<boolean> = Promise.resolve(false);
        act(() => {
            proposed = result.current.propose(BETO);
        });
        expect(result.current.busy).toBe('proposing');
        await act(async () => {
            resolvePropose(transfer());
            await proposed;
        });

        await expect(proposed).resolves.toBe(true);
        await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'pending', toUserId: BETO, toName: 'Beto' }));
        expect(result.current.busy).toBeNull();
        expect(source.getServerTransfer).toHaveBeenCalledTimes(1);
    });

    it('ends without an error when the same transfer was already pending', async () => {
        const source = fakeSource({
            proposeTransfer: vi.fn(async () => Promise.reject(httpError(409))),
        });
        const { result } = render(source);
        await waitFor(() => expect(result.current.loading).toBe(false));
        vi.mocked(source.getServerTransfer).mockResolvedValue(transfer());

        let proposed = false;
        await act(async () => {
            proposed = await result.current.propose(BETO);
        });

        expect(proposed).toBe(true);
        expect(result.current.error).toBeNull();
        expect(result.current.view).toMatchObject({ kind: 'pending', toUserId: BETO });
    });

    it('names the other recipient when another transfer is already pending', async () => {
        const source = fakeSource({
            proposeTransfer: vi.fn(async () => Promise.reject(httpError(409))),
        });
        const { result } = render(source);
        await waitFor(() => expect(result.current.loading).toBe(false));
        vi.mocked(source.getServerTransfer).mockResolvedValue(transfer({ to_user_id: CARO }));

        let proposed = true;
        await act(async () => {
            proposed = await result.current.propose(BETO);
        });

        expect(proposed).toBe(false);
        await waitFor(() =>
            expect(result.current.error).toEqual({ kind: 'already-pending', toUserId: CARO, toName: 'Caro' }),
        );
    });

    it('reads again when the recipient is no longer a member', async () => {
        const source = fakeSource({ proposeTransfer: vi.fn(async () => Promise.reject(httpError(422))) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.propose(BETO);
        });

        expect(result.current.error).toEqual({ kind: 'not-member' });
        expect(source.getServerTransfer).toHaveBeenCalledTimes(2);
    });

    it('reports the lost connection, reads again and retries the same proposal', async () => {
        const source = fakeSource({ proposeTransfer: vi.fn(async () => Promise.reject(networkError)) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.propose(BETO);
        });
        expect(result.current.error).toEqual({ kind: 'network' });
        expect(source.getServerTransfer).toHaveBeenCalledTimes(2);

        vi.mocked(source.proposeTransfer).mockResolvedValue(transfer());
        await act(async () => {
            result.current.retry();
        });

        expect(source.proposeTransfer).toHaveBeenLastCalledWith(SERVER, BETO);
        await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'pending', toUserId: BETO }));
        expect(result.current.error).toBeNull();
    });

    it('reports a service failure when community is down', async () => {
        const source = fakeSource({ proposeTransfer: vi.fn(async () => Promise.reject(httpError(503))) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.propose(BETO);
        });

        expect(result.current.error).toEqual({ kind: 'service' });
    });

    it('shows nothing after cancelling the pending transfer', async () => {
        const source = fakeSource({ getServerTransfer: vi.fn(async () => transfer()) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.view.kind).toBe('pending'));

        await act(async () => {
            await result.current.cancel();
        });

        expect(source.cancelTransfer).toHaveBeenCalledWith(SERVER);
        expect(result.current.view).toEqual({ kind: 'none' });
    });

    it('tells a member who is not the owner that only the owner can cancel', async () => {
        const source = fakeSource({
            getServerTransfer: vi.fn(async () => transfer()),
            cancelTransfer: vi.fn(async () => Promise.reject(httpError(403))),
        });
        const { result } = render(source);
        await waitFor(() => expect(result.current.view.kind).toBe('pending'));

        await act(async () => {
            await result.current.cancel();
        });

        expect(result.current.error).toEqual({ kind: 'not-owner' });
    });

    it('shows nothing once the viewer is no longer the owner', async () => {
        const source = fakeSource({ getServerTransfer: vi.fn(async () => transfer()) });
        const { result, rerender } = render(source);
        await waitFor(() => expect(result.current.view.kind).toBe('pending'));

        rerender({ isOwner: false });

        expect(result.current.view).toEqual({ kind: 'none' });
    });

    it('treats a forbidden read as nothing to show, without an error', async () => {
        const source = fakeSource({ getServerTransfer: vi.fn(async () => Promise.reject(httpError(403))) });
        const { result } = render(source);

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.view).toEqual({ kind: 'none' });
        expect(result.current.error).toBeNull();
    });

    it('keeps a closed rejection hidden when the same rejection is read again', async () => {
        const source = fakeSource({ getServerTransfer: vi.fn(async () => transfer({ status: 'rejected' })) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.view).toMatchObject({ kind: 'rejected', toName: 'Beto' }));

        act(() => {
            result.current.dismissRejection();
        });
        expect(result.current.view).toEqual({ kind: 'none' });

        await act(async () => {
            result.current.reload();
        });
        expect(result.current.view).toEqual({ kind: 'none' });
    });
});
