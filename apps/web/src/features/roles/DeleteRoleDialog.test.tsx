import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoleDeletionState } from '@discordia/core';
import type { Role } from '@discordia/api';
import { DeleteRoleDialog } from './DeleteRoleDialog';

const role: Role = {
    id: 'r1',
    server_id: 'srv',
    name: 'Moderador',
    is_default: false,
    permissions: 0,
    permission_names: [],
    position: 1,
    created_at: '2026-10-01T00:00:00Z',
};

const renderDialog = (state: Exclude<RoleDeletionState, { stage: 'idle' }>) => {
    const handlers = { onConfirm: vi.fn(), onRetry: vi.fn(), onClose: vi.fn() };
    render(<DeleteRoleDialog state={state} {...handlers} />);
    return { ...handlers, user: userEvent.setup() };
};

describe('DeleteRoleDialog', () => {
    it('names the role and warns it cannot be undone', async () => {
        const { onConfirm, user } = renderDialog({ stage: 'confirming', role, deleting: false, error: null });

        expect(screen.getByText('¿Eliminar el rol Moderador? Esta acción no se puede deshacer.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Eliminar' }));

        expect(onConfirm).toHaveBeenCalled();
    });

    it('shows that it is deleting and disables the buttons', () => {
        renderDialog({ stage: 'confirming', role, deleting: true, error: null });

        expect(screen.getByRole('button', { name: 'Eliminando...' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });

    it('explains why the default role cannot be deleted, with only a way to close', () => {
        renderDialog({ stage: 'blocked', role: { ...role, is_default: true }, blocker: 'default-role' });

        expect(screen.getByText('Es el rol por defecto. Elegí otro rol por defecto antes de eliminarlo')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    });

    it('explains why the only source of ADMINISTRATOR cannot be deleted', () => {
        renderDialog({ stage: 'blocked', role, blocker: 'sole-admin' });

        expect(
            screen.getByText('No podés eliminar este rol: es el que te da la administración del servidor'),
        ).toBeInTheDocument();
    });

    it('offers to retry a lost connection', async () => {
        const { onRetry, user } = renderDialog({ stage: 'confirming', role, deleting: false, error: { kind: 'network' } });

        expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión.');
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));

        expect(onRetry).toHaveBeenCalled();
    });

    it('shows the reason of a rejection without offering to retry', () => {
        renderDialog({
            stage: 'confirming',
            role,
            deleting: false,
            error: { kind: 'rejected', message: 'No tenés permiso para eliminar roles' },
        });

        expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para eliminar roles');
        expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });

    it('only lets close once the server is gone', async () => {
        const { onClose, user } = renderDialog({ stage: 'confirming', role, deleting: false, error: { kind: 'server-gone' } });

        expect(screen.getByRole('alert')).toHaveTextContent('El servidor ya no existe');
        await user.click(screen.getAllByRole('button', { name: 'Cerrar' }).at(-1)!);

        expect(onClose).toHaveBeenCalled();
    });
});
