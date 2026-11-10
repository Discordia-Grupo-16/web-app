import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { OwnershipTransfer, PublicProfiles } from '@discordia/api';
import { ownershipSource } from '@/shared/api';
import { IncomingTransferBanner } from './IncomingTransferBanner';

vi.mock('@/shared/api', () => ({
    ownershipSource: {
        getServerTransfer: vi.fn(),
        proposeTransfer: vi.fn(),
        cancelTransfer: vi.fn(),
        acceptTransfer: vi.fn(),
        rejectTransfer: vi.fn(),
        listMyTransfers: vi.fn(),
        getServer: vi.fn(),
        getServers: vi.fn(),
    },
}));

const pending = (serverId: string, serverName: string): OwnershipTransfer => ({
    server_id: serverId,
    server_name: serverName,
    from_user_id: 'ana',
    to_user_id: 'beto',
    status: 'pending',
    created_at: '2026-11-05T10:00:00Z',
    resolved_at: null,
});

const profiles: PublicProfileSource = {
    getPublicProfiles: async (ids): Promise<PublicProfiles> =>
        new Map(ids.map((id) => [id, { id, name: 'Ana', avatarUrl: null, bio: null }] as const)),
    peekPublicProfile: () => undefined,
};

const renderBanner = () =>
    render(
        <PublicProfilesProvider source={profiles}>
            <IncomingTransferBanner />
        </PublicProfilesProvider>,
    );

describe('IncomingTransferBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(ownershipSource.listMyTransfers).mockResolvedValue([
            pending('a', 'Grupo 16'),
            pending('b', 'Facultad'),
        ]);
        vi.mocked(ownershipSource.getServers).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
        vi.mocked(ownershipSource.acceptTransfer).mockResolvedValue(undefined);
        vi.mocked(ownershipSource.rejectTransfer).mockResolvedValue(undefined);
    });

    it('shows one stripe per pending transfer, with who proposes it', async () => {
        renderBanner();

        expect(await screen.findByText('Ana te propone ser el dueño de «Grupo 16»')).toBeInTheDocument();
        expect(screen.getByText('Ana te propone ser el dueño de «Facultad»')).toBeInTheDocument();
    });

    it('asks to confirm before accepting', async () => {
        const user = userEvent.setup();
        renderBanner();
        const stripe = await screen.findByRole('region', { name: 'Ana te propone ser el dueño de «Grupo 16»' });

        await user.click(within(stripe).getByRole('button', { name: 'Aceptar' }));

        expect(screen.getByText('Vas a ser el dueño de «Grupo 16»')).toBeInTheDocument();
        expect(ownershipSource.acceptTransfer).not.toHaveBeenCalled();
        // The confirmation opens inside the stripe it belongs to; its button is the last "Aceptar" there.
        await user.click(within(stripe).getAllByRole('button', { name: 'Aceptar' }).at(-1)!);
        await waitFor(() => expect(ownershipSource.acceptTransfer).toHaveBeenCalledWith('a'));
    });

    it('rejects without asking to confirm', async () => {
        const user = userEvent.setup();
        renderBanner();
        const stripe = await screen.findByRole('region', { name: 'Ana te propone ser el dueño de «Grupo 16»' });

        await user.click(within(stripe).getByRole('button', { name: 'Rechazar' }));

        await waitFor(() => expect(ownershipSource.rejectTransfer).toHaveBeenCalledWith('a'));
        expect(screen.queryByText('Vas a ser el dueño de «Grupo 16»')).not.toBeInTheDocument();
    });

    it('disables the buttons while an action is running', async () => {
        vi.mocked(ownershipSource.rejectTransfer).mockReturnValue(new Promise(() => undefined));
        const user = userEvent.setup();
        renderBanner();
        const stripe = await screen.findByRole('region', { name: 'Ana te propone ser el dueño de «Grupo 16»' });

        await user.click(within(stripe).getByRole('button', { name: 'Rechazar' }));

        expect(within(stripe).getByRole('button', { name: 'Rechazando…' })).toBeDisabled();
        expect(within(stripe).getByRole('button', { name: 'Aceptar' })).toBeDisabled();
    });

    it('explains a transfer that is no longer available and lets the user close it', async () => {
        vi.mocked(ownershipSource.rejectTransfer).mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
        const user = userEvent.setup();
        renderBanner();
        const stripe = await screen.findByRole('region', { name: 'Ana te propone ser el dueño de «Grupo 16»' });

        await user.click(within(stripe).getByRole('button', { name: 'Rechazar' }));

        expect(await within(stripe).findByRole('alert')).toHaveTextContent('Esta transferencia ya no está disponible');
        vi.mocked(ownershipSource.listMyTransfers).mockResolvedValue([pending('b', 'Facultad')]);
        await user.click(within(stripe).getByRole('button', { name: 'Cerrar' }));

        await waitFor(() =>
            expect(screen.queryByRole('region', { name: 'Ana te propone ser el dueño de «Grupo 16»' })).not.toBeInTheDocument(),
        );
    });
});
