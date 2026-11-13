// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OwnershipTransfer, PublicProfiles } from '@discordia/api';
import { PublicProfilesProvider, type PublicProfileSource } from '../profiles/PublicProfilesProvider';
import type { OwnershipTransferSource } from './types';
import { useIncomingOwnershipTransfers } from './useIncomingOwnershipTransfers';

const pending = (serverId: string): OwnershipTransfer => ({
    server_id: serverId,
    server_name: `Servidor ${serverId}`,
    from_user_id: 'ana',
    to_user_id: 'beto',
    status: 'pending',
    created_at: '2026-11-05T10:00:00Z',
    resolved_at: null,
});

const httpError = (status: number) => ({ isAxiosError: true, response: { status } });
const networkError = { isAxiosError: true, response: undefined };

const fakeSource = (overrides: Partial<OwnershipTransferSource> = {}): OwnershipTransferSource => ({
    getServerTransfer: vi.fn(async () => pending('a')),
    proposeTransfer: vi.fn(async () => pending('a')),
    cancelTransfer: vi.fn(async () => undefined),
    acceptTransfer: vi.fn(async () => undefined),
    rejectTransfer: vi.fn(async () => undefined),
    listMyTransfers: vi.fn(async () => [pending('a')]),
    getServer: vi.fn(async () => ({})),
    getServers: vi.fn(async () => [{ id: 'a' }]),
    ...overrides,
});

const profiles: PublicProfileSource = {
    getPublicProfiles: async (ids): Promise<PublicProfiles> =>
        new Map(ids.map((id) => [id, { id, name: 'Ana', avatarUrl: null, bio: null }] as const)),
    peekPublicProfile: () => undefined,
};

const wrapper = ({ children }: { children: ReactNode }) => (
    <PublicProfilesProvider source={profiles}>{children}</PublicProfilesProvider>
);

const render = (source: OwnershipTransferSource) =>
    renderHook(() => useIncomingOwnershipTransfers({ source }), { wrapper });

describe('useIncomingOwnershipTransfers', () => {
    it('shows only the transfers of servers I am still in, with who proposes them', async () => {
        const source = fakeSource({
            listMyTransfers: vi.fn(async () => [pending('a'), pending('deleted')]),
            getServers: vi.fn(async () => [{ id: 'a' }]),
        });
        const { result } = render(source);

        await waitFor(() =>
            expect(result.current.transfers).toEqual([
                {
                    serverId: 'a',
                    serverName: 'Servidor a',
                    fromUserId: 'ana',
                    fromName: 'Ana',
                    fromNameLoading: false,
                    busy: null,
                    error: null,
                    stale: false,
                },
            ]),
        );
    });

    it('reads again after accepting, so the banner goes away', async () => {
        let resolveAccept: () => void = () => undefined;
        const source = fakeSource({
            acceptTransfer: vi.fn(() => new Promise<void>((resolve) => (resolveAccept = resolve))),
        });
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));

        let accepted: Promise<void> = Promise.resolve();
        act(() => {
            accepted = result.current.accept('a');
        });
        expect(result.current.transfers[0].busy).toBe('accepting');
        vi.mocked(source.listMyTransfers).mockResolvedValue([]);
        await act(async () => {
            resolveAccept();
            await accepted;
        });

        expect(source.acceptTransfer).toHaveBeenCalledWith('a');
        expect(result.current.transfers).toEqual([]);
    });

    it('marks the banner as stale when the transfer is no longer for me', async () => {
        const source = fakeSource({ acceptTransfer: vi.fn(async () => Promise.reject(httpError(403))) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));

        await act(async () => {
            await result.current.accept('a');
        });

        expect(result.current.transfers[0]).toMatchObject({ error: { kind: 'unavailable' }, stale: true });
    });

    it('tells a deleted server from an unavailable transfer after a 404 on accept', async () => {
        const source = fakeSource({
            acceptTransfer: vi.fn(async () => Promise.reject(httpError(404))),
            getServer: vi.fn(async () => Promise.reject(httpError(404))),
        });
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));

        await act(async () => {
            await result.current.accept('a');
        });

        expect(source.getServer).toHaveBeenCalledWith('a');
        expect(result.current.transfers[0]).toMatchObject({ error: { kind: 'server-gone' }, stale: true });
    });

    it('treats a 404 on accept in a server that still exists as an unavailable transfer', async () => {
        const source = fakeSource({ acceptTransfer: vi.fn(async () => Promise.reject(httpError(404))) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));

        await act(async () => {
            await result.current.accept('a');
        });

        expect(result.current.transfers[0]).toMatchObject({ error: { kind: 'unavailable' }, stale: true });
    });

    it('takes a 404 on reject as a deleted server without asking for it', async () => {
        const source = fakeSource({ rejectTransfer: vi.fn(async () => Promise.reject(httpError(404))) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));

        await act(async () => {
            await result.current.reject('a');
        });

        expect(source.getServer).not.toHaveBeenCalled();
        expect(result.current.transfers[0]).toMatchObject({ error: { kind: 'server-gone' }, stale: true });
    });

    it('reads again without an error when rejecting a transfer already accepted elsewhere', async () => {
        const source = fakeSource();
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));
        vi.mocked(source.listMyTransfers).mockResolvedValue([]);

        await act(async () => {
            await result.current.reject('a');
        });

        expect(result.current.transfers).toEqual([]);
    });

    it('reports the lost connection and retries the same action', async () => {
        const source = fakeSource({ acceptTransfer: vi.fn(async () => Promise.reject(networkError)) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));

        await act(async () => {
            await result.current.accept('a');
        });
        expect(result.current.transfers[0]).toMatchObject({ error: { kind: 'network' }, stale: false });

        vi.mocked(source.acceptTransfer).mockResolvedValue(undefined);
        vi.mocked(source.listMyTransfers).mockResolvedValue([]);
        await act(async () => {
            result.current.retry('a');
        });

        await waitFor(() => expect(result.current.transfers).toEqual([]));
        expect(source.acceptTransfer).toHaveBeenCalledTimes(2);
    });

    it('removes a stale banner when it is closed', async () => {
        const source = fakeSource({ acceptTransfer: vi.fn(async () => Promise.reject(httpError(403))) });
        const { result } = render(source);
        await waitFor(() => expect(result.current.transfers).toHaveLength(1));
        await act(async () => {
            await result.current.accept('a');
        });
        vi.mocked(source.listMyTransfers).mockResolvedValue([]);

        act(() => {
            result.current.dismiss('a');
        });

        expect(result.current.transfers).toEqual([]);
    });
});
