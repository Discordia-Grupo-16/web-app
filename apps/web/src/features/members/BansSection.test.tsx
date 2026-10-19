import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, ServerBan } from '@discordia/api';
import { membersService } from '@/shared/api';
import { BansSection } from './BansSection';

vi.mock('@/shared/api', () => ({ membersService: { revokeBan: vi.fn() } }));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Felipe', avatarUrl: null } }),
}));

const ban = (userId: string, reason: string | null = null): ServerBan => ({
    user_id: userId,
    banned_by: 'owner',
    reason,
    // No time zone, as `community` sends it, and at noon so no zone moves it to another day.
    created_at: '2026-10-01T12:00:00',
});

const profiles: PublicProfiles = new Map([
    ['milton', { id: 'milton', name: 'Milton', avatarUrl: null, bio: null }],
    ['owner', { id: 'owner', name: 'Bruno', avatarUrl: null, bio: null }],
]);

const renderSection = (bans: ServerBan[] = [ban('milton', 'spam')]) => {
    const onBanRevoked = vi.fn();
    const source: PublicProfileSource = {
        getPublicProfiles: async () => profiles,
        peekPublicProfile: () => undefined,
    };
    render(
        <PublicProfilesProvider source={source}>
            <BansSection serverId="srv" bans={bans} onBanRevoked={onBanRevoked} />
        </PublicProfilesProvider>,
    );
    return { onBanRevoked, user: userEvent.setup() };
};

describe('BansSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows who is banned, who banned them and why', async () => {
        // Both names come from `identity`: the moderator is resolved in the same request.
        renderSection();

        expect(await screen.findByText('Milton')).toBeInTheDocument();
        expect(await screen.findByText(/^Baneado por Bruno el /)).toBeInTheDocument();
        expect(screen.getByText('Motivo: spam')).toBeInTheDocument();
    });

    it('counts the bans', () => {
        renderSection([ban('milton'), ban('caro')]);

        expect(screen.getByText('Baneados — 2')).toBeInTheDocument();
    });

    it('leaves the reason line out when there is none', async () => {
        renderSection([ban('milton')]);
        await screen.findByText('Milton');

        expect(screen.queryByText(/^Motivo:/)).not.toBeInTheDocument();
    });

    it('says so when nobody is banned', () => {
        renderSection([]);

        expect(screen.getByText('No hay usuarios baneados.')).toBeInTheDocument();
    });

    it('warns that revoking does not bring them back by itself', async () => {
        const { user } = renderSection();
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Revocar el baneo de Milton'));

        expect(screen.getByText(/tiene que aceptar una/)).toBeInTheDocument();
    });

    it('revokes and reports it so the row goes away', async () => {
        vi.mocked(membersService.revokeBan).mockResolvedValue(undefined);
        const { user, onBanRevoked } = renderSection();
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Revocar el baneo de Milton'));
        await user.click(screen.getByRole('button', { name: 'Revocar baneo' }));

        expect(membersService.revokeBan).toHaveBeenCalledWith('srv', 'milton');
        expect(onBanRevoked).toHaveBeenCalledWith('milton');
    });

    it('shows why the backend refused and keeps the row', async () => {
        vi.mocked(membersService.revokeBan).mockRejectedValue({
            response: {
                data: { detail: 'No tenés permiso para revocar baneos en este servidor' },
            },
        });
        const { user, onBanRevoked } = renderSection();
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Revocar el baneo de Milton'));
        await user.click(screen.getByRole('button', { name: 'Revocar baneo' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/No tenés permiso/);
        expect(onBanRevoked).not.toHaveBeenCalled();
    });

    it('does not revoke when the dialog is dismissed', async () => {
        const { user, onBanRevoked } = renderSection();
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Revocar el baneo de Milton'));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(membersService.revokeBan).not.toHaveBeenCalled();
        expect(onBanRevoked).not.toHaveBeenCalled();
    });
});
