import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invitation } from '@discordia/api';
import { invitationsService } from '@/shared/api';
import { InviteModal } from './InviteModal';

vi.mock('@/shared/api', () => ({
    invitationsService: { listInvitations: vi.fn(), createInvitation: vi.fn(), revokeInvitation: vi.fn() },
}));

const invitation = (code: string, overrides: Partial<Invitation> = {}): Invitation => ({
    id: `id-${code}`,
    server_id: 'srv',
    code,
    created_by: 'owner',
    expires_at: null,
    max_uses: null,
    uses: 0,
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
});

const renderModal = (onClose = vi.fn()) => {
    const user = userEvent.setup();
    render(<InviteModal serverId="srv" onClose={onClose} />);
    return { user, onClose };
};

describe('InviteModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(invitationsService.listInvitations).mockResolvedValue([]);
    });

    it('lists the active invitations with their uses', async () => {
        vi.mocked(invitationsService.listInvitations).mockResolvedValue([
            invitation('abc', { uses: 2, max_uses: 5 }),
            invitation('def', { uses: 1 }),
        ]);
        renderModal();

        expect(await screen.findByText('abc')).toBeInTheDocument();
        expect(screen.getByText(/Usos: 2\/5/)).toBeInTheDocument();
        expect(screen.getByText(/Usos: 1(?!\/)/)).toBeInTheDocument();
        expect(invitationsService.listInvitations).toHaveBeenCalledWith('srv');
    });

    it('shows the empty state', async () => {
        renderModal();
        expect(await screen.findByText('No hay invitaciones activas')).toBeInTheDocument();
    });

    it('shows an error when the list cannot be loaded', async () => {
        vi.mocked(invitationsService.listInvitations).mockRejectedValue(new Error('network'));
        renderModal();
        expect(await screen.findByText('No se pudieron cargar las invitaciones.')).toBeInTheDocument();
    });

    it('creates an invitation, shows its link and adds it to the list', async () => {
        vi.mocked(invitationsService.createInvitation).mockResolvedValue(invitation('new123'));
        const { user } = renderModal();
        await screen.findByText('No hay invitaciones activas');

        await user.click(screen.getByRole('button', { name: 'Generar invitación' }));

        expect(await screen.findByText(`${window.location.origin}/invite/new123`)).toBeInTheDocument();
        expect(screen.getByText('new123')).toBeInTheDocument();
        expect(screen.queryByText('No hay invitaciones activas')).not.toBeInTheDocument();
    });

    it('revokes an invitation after confirming and removes it from the list', async () => {
        vi.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc'), invitation('def')]);
        vi.mocked(invitationsService.revokeInvitation).mockResolvedValue();
        const { user, onClose } = renderModal();
        await screen.findByText('abc');

        await user.click(screen.getByRole('button', { name: 'Revocar abc' }));
        expect(screen.getByText('¿Revocar el código "abc"?')).toBeInTheDocument();
        await user.click(within(screen.getByText('Revocar invitación').parentElement!).getByRole('button', { name: 'Revocar' }));

        await waitFor(() => expect(screen.queryByText('abc')).not.toBeInTheDocument());
        expect(invitationsService.revokeInvitation).toHaveBeenCalledWith('srv', 'abc');
        expect(screen.getByText('def')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('does not revoke when the confirmation is cancelled', async () => {
        vi.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc')]);
        const { user } = renderModal();
        await screen.findByText('abc');

        await user.click(screen.getByRole('button', { name: 'Revocar abc' }));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(invitationsService.revokeInvitation).not.toHaveBeenCalled();
        expect(screen.getByText('abc')).toBeInTheDocument();
    });

    it('keeps the invitation and shows an error when revoking fails', async () => {
        vi.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc')]);
        vi.mocked(invitationsService.revokeInvitation).mockRejectedValue(new Error('network'));
        const { user } = renderModal();
        await screen.findByText('abc');

        await user.click(screen.getByRole('button', { name: 'Revocar abc' }));
        await user.click(within(screen.getByText('Revocar invitación').parentElement!).getByRole('button', { name: 'Revocar' }));

        expect(await screen.findByText('No se pudo revocar la invitación.')).toBeInTheDocument();
        expect(screen.getByText('abc')).toBeInTheDocument();
    });

    it('copies the link, not the bare code', async () => {
        vi.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc')]);
        const { user } = renderModal();
        const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
        await screen.findByText('abc');

        await user.click(screen.getByRole('button', { name: 'Copiar link de abc' }));

        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite/abc`);
    });
});
