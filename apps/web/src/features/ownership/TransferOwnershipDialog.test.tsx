import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OwnershipError } from '@discordia/core';
import { TransferOwnershipDialog } from './TransferOwnershipDialog';

const renderDialog = (overrides: { busy?: boolean; error?: OwnershipError | null } = {}) => {
    const callbacks = { onConfirm: vi.fn(), onRetry: vi.fn(), onClose: vi.fn() };
    render(
        <TransferOwnershipDialog
            toName="Beto"
            serverName="Grupo 16"
            busy={overrides.busy ?? false}
            error={overrides.error ?? null}
            {...callbacks}
        />,
    );
    return callbacks;
};

describe('TransferOwnershipDialog', () => {
    it('names the member and the server, and says what the owner gives up', () => {
        renderDialog();

        expect(
            screen.getByText('¿Querés proponerle a Beto que sea el nuevo dueño de «Grupo 16»? Beto tiene que aceptar. Cuando acepte, vas a dejar de ser el dueño.'),
        ).toBeInTheDocument();
    });

    it('proposes on confirm', async () => {
        const { onConfirm } = renderDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

        expect(onConfirm).toHaveBeenCalled();
    });

    it('disables the buttons while proposing', () => {
        renderDialog({ busy: true });

        expect(screen.getByRole('button', { name: 'Enviar propuesta' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });

    it('shows a lost connection and retries', async () => {
        const { onRetry, onConfirm } = renderDialog({ error: { kind: 'network' } });

        expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión.');
        await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

        expect(onRetry).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('names who the pending transfer is for when there already is one', () => {
        renderDialog({ error: { kind: 'already-pending', toUserId: 'caro', toName: 'Caro' } });

        expect(screen.getByRole('alert')).toHaveTextContent('Ya hay una transferencia pendiente a Caro');
    });

    it('closes from cancel', async () => {
        const { onClose } = renderDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onClose).toHaveBeenCalled();
    });
});
