import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, PublicUser, Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { PublicProfileModal } from './PublicProfileModal';

vi.mock('@/shared/api', () => ({ serversService: { getServers: vi.fn() } }));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Felipe' } }),
}));

const milton: PublicUser = { id: 'milton', name: 'Milton', avatarUrl: 'https://cdn/milton.png', bio: 'Hago el backend' };
const server = (id: string, name: string): Server => ({
    id,
    name,
    description: null,
    owner_id: 'owner',
    avatar_url: null,
    created_at: '2026-10-01T00:00:00Z',
    my_permissions: 7,
    my_permission_names: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'CONNECT'],
    channels: [],
});

const renderModal = (getPublicProfiles: PublicProfileSource['getPublicProfiles'], userId = 'milton') => {
    const onClose = vi.fn();
    const source: PublicProfileSource = { getPublicProfiles, peekPublicProfile: () => undefined };
    render(
        <PublicProfilesProvider source={source}>
            <PublicProfileModal userId={userId} onClose={onClose} />
        </PublicProfilesProvider>,
    );
    return { onClose };
};

const found = (...users: PublicUser[]) => async (): Promise<PublicProfiles> => new Map(users.map((u) => [u.id, u]));

describe('PublicProfileModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(serversService.getServers).mockResolvedValue([]);
    });

    it('shows the name, photo and bio of the user', async () => {
        renderModal(found(milton));

        expect(await screen.findByRole('heading', { name: 'Milton' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: 'Milton' })).toHaveAttribute('src', 'https://cdn/milton.png');
        expect(screen.getByText('Hago el backend')).toBeInTheDocument();
    });

    it('shows a loading state until the profile arrives', async () => {
        renderModal(found(milton));

        expect(screen.getByText('Cargando perfil...')).toBeInTheDocument();
        await screen.findByRole('heading', { name: 'Milton' });
    });

    it('lists the servers in common, asking only for the ones shared with that user', async () => {
        vi.mocked(serversService.getServers).mockResolvedValue([server('s1', 'Discordia'), server('s2', 'Ingeniería')]);

        renderModal(found(milton));

        expect(await screen.findByText('Discordia')).toBeInTheDocument();
        expect(screen.getByText('Ingeniería')).toBeInTheDocument();
        expect(serversService.getServers).toHaveBeenCalledWith({ withUser: 'milton' });
    });

    it('says so when there are no servers in common', async () => {
        renderModal(found(milton));

        expect(await screen.findByText('No tienen servidores en común.')).toBeInTheDocument();
    });

    it('keeps the profile visible when the servers in common fail, and retries them', async () => {
        vi.mocked(serversService.getServers).mockRejectedValueOnce(new Error('community down'));
        renderModal(found(milton));
        const user = userEvent.setup();

        expect(await screen.findByText(/No pudimos cargar los servidores en común/)).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Milton' })).toBeInTheDocument();

        vi.mocked(serversService.getServers).mockResolvedValue([server('s1', 'Discordia')]);
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));

        expect(await screen.findByText('Discordia')).toBeInTheDocument();
    });

    it('shows "El perfil no está disponible" for a suspended or nonexistent account', async () => {
        renderModal(async () => new Map());

        expect(await screen.findByText('El perfil no está disponible')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Usuario no disponible' })).toBeInTheDocument();
        expect(serversService.getServers).not.toHaveBeenCalled();
    });

    it('shows an error with a retry when the profile cannot be loaded', async () => {
        const getPublicProfiles = vi.fn<PublicProfileSource['getPublicProfiles']>().mockRejectedValueOnce(new Error('network'));
        getPublicProfiles.mockImplementation(found(milton));
        renderModal(getPublicProfiles);
        const user = userEvent.setup();

        expect(await screen.findByText(/No pudimos cargar el perfil/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));

        expect(await screen.findByRole('heading', { name: 'Milton' })).toBeInTheDocument();
    });

    it('does not show servers in common on the own profile', async () => {
        renderModal(found({ ...milton, id: 'me', name: 'Felipe' }), 'me');

        expect(await screen.findByRole('heading', { name: 'Felipe' })).toBeInTheDocument();
        expect(serversService.getServers).not.toHaveBeenCalled();
    });

    it('does not show private data', async () => {
        renderModal(found(milton));

        await screen.findByRole('heading', { name: 'Milton' });
        expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    });

    it('closes with the button, the backdrop and Escape', async () => {
        const { onClose } = renderModal(found(milton));
        const user = userEvent.setup();
        await screen.findByRole('heading', { name: 'Milton' });

        await user.click(screen.getByRole('button', { name: 'Cerrar' }));
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('dialog').parentElement!);

        expect(onClose).toHaveBeenCalledTimes(3);
    });
});
