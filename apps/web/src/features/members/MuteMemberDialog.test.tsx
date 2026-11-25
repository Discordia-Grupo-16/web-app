import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSION_COPY, formatMutedUntil } from '@discordia/core';
import { membersService } from '@/shared/api';
import { MuteMemberDialog } from './MuteMemberDialog';

vi.mock('@/shared/api', () => ({
    membersService: { muteMember: vi.fn(), unmuteMember: vi.fn() },
}));

const FUTURE = '2099-01-01T15:30:00Z';
const PAST = '2020-01-01T15:30:00Z';

const renderDialog = (mutedUntil: string | null) => {
    const onClose = vi.fn();
    const onChanged = vi.fn();
    render(
        <MuteMemberDialog
            serverId="srv"
            userId="milton"
            memberName="Milton"
            mutedUntil={mutedUntil}
            onClose={onClose}
            onChanged={onChanged}
        />,
    );
    return { onClose, onChanged, user: userEvent.setup() };
};

describe('MuteMemberDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('with a member who is not muted', () => {
        it('warns that the member stays and offers the durations', () => {
            renderDialog(null);

            expect(screen.getByText(PERMISSION_COPY.muteMemberWarning('Milton'))).toBeInTheDocument();
            expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
                '60 segundos',
                '5 minutos',
                '10 minutos',
                '1 hora',
                '1 día',
                '1 semana',
            ]);
        });

        it('treats a mute that already ended as no mute', () => {
            renderDialog(PAST);

            expect(screen.getByRole('button', { name: 'Silenciar' })).toBeInTheDocument();
            expect(screen.queryByRole('button', { name: 'Levantar silencio' })).not.toBeInTheDocument();
        });

        it('mutes for the chosen duration and closes', async () => {
            vi.mocked(membersService.muteMember).mockResolvedValue({ user_id: 'milton', muted_until: FUTURE, muted_by: 'me' });
            const { user, onClose, onChanged } = renderDialog(null);

            await user.selectOptions(screen.getByLabelText('Duración'), '1 hora');
            await user.click(screen.getByRole('button', { name: 'Silenciar' }));

            expect(membersService.muteMember).toHaveBeenCalledWith('srv', 'milton', 3600);
            expect(onChanged).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });

        it('shows the detail of the backend as it comes and stays open', async () => {
            vi.mocked(membersService.muteMember).mockRejectedValue({
                response: { data: { detail: 'No podés moderar a un miembro con jerarquía igual o superior a la tuya' } },
            });
            const { user, onClose, onChanged } = renderDialog(null);

            await user.click(screen.getByRole('button', { name: 'Silenciar' }));

            expect(await screen.findByRole('alert')).toHaveTextContent(/jerarquía igual o superior/);
            expect(onChanged).not.toHaveBeenCalled();
            expect(onClose).not.toHaveBeenCalled();
        });

        it('falls back to its own text when the error has no detail', async () => {
            vi.mocked(membersService.muteMember).mockRejectedValue(new Error('network'));
            const { user } = renderDialog(null);

            await user.click(screen.getByRole('button', { name: 'Silenciar' }));

            expect(await screen.findByRole('alert')).toHaveTextContent(PERMISSION_COPY.muteMemberError);
        });

        it('does not mute when it is dismissed', async () => {
            const { user, onClose } = renderDialog(null);

            await user.click(screen.getByRole('button', { name: 'Cancelar' }));

            expect(membersService.muteMember).not.toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('with a member who is muted', () => {
        it('says until when and offers to lift it, with no durations', () => {
            renderDialog(FUTURE);

            expect(screen.getByText(PERMISSION_COPY.mutedBadge(formatMutedUntil(FUTURE)))).toBeInTheDocument();
            expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Levantar silencio' })).toBeInTheDocument();
        });

        it('lifts the mute and closes', async () => {
            vi.mocked(membersService.unmuteMember).mockResolvedValue(undefined);
            const { user, onClose, onChanged } = renderDialog(FUTURE);

            await user.click(screen.getByRole('button', { name: 'Levantar silencio' }));

            expect(membersService.unmuteMember).toHaveBeenCalledWith('srv', 'milton');
            expect(membersService.muteMember).not.toHaveBeenCalled();
            expect(onChanged).toHaveBeenCalled();
            expect(onClose).toHaveBeenCalled();
        });

        it('shows the detail of the backend when lifting is refused', async () => {
            vi.mocked(membersService.unmuteMember).mockRejectedValue({
                response: { data: { detail: 'No tenés permiso para levantar silencios en este servidor' } },
            });
            const { user, onChanged } = renderDialog(FUTURE);

            await user.click(screen.getByRole('button', { name: 'Levantar silencio' }));

            expect(await screen.findByRole('alert')).toHaveTextContent(/No tenés permiso para levantar silencios/);
            expect(onChanged).not.toHaveBeenCalled();
        });
    });
});
