import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const renderDialog = (props: Partial<ComponentProps<typeof ConfirmDialog>> = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
        <ConfirmDialog
            open
            title="¿Suspender a Ana?"
            description="Detalle de la acción."
            confirmLabel="Suspender cuenta"
            tone="danger"
            isSubmitting={false}
            error={null}
            onConfirm={onConfirm}
            onCancel={onCancel}
            {...props}
        />,
    );
    return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
    it('is a labelled modal dialog', () => {
        renderDialog();

        const dialog = screen.getByRole('dialog', { name: '¿Suspender a Ana?' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleDescription('Detalle de la acción.');
    });

    it('renders nothing when closed', () => {
        renderDialog({ open: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('puts the initial focus on Cancelar, not on the destructive button', () => {
        renderDialog();

        expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    });

    it('cancels on Escape', async () => {
        const { onCancel } = renderDialog();

        await userEvent.keyboard('{Escape}');

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('confirms and cancels through their buttons', async () => {
        const { onConfirm, onCancel } = renderDialog();

        await userEvent.click(screen.getByRole('button', { name: 'Suspender cuenta' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('requires the confirmation text before enabling the confirm button', async () => {
        const { onConfirm } = renderDialog({ confirmationText: 'Discordia' });
        const confirmButton = screen.getByRole('button', { name: 'Suspender cuenta' });
        const confirmationInput = screen.getByRole('textbox', { name: /escribí Discordia/i });

        expect(confirmButton).toBeDisabled();
        await userEvent.type(confirmationInput, 'Discord');
        expect(confirmButton).toBeDisabled();

        await userEvent.clear(confirmationInput);
        await userEvent.type(confirmationInput, 'Discordia');
        expect(confirmButton).toBeEnabled();
        await userEvent.click(confirmButton);

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('while submitting disables both buttons, says Procesando… and ignores Escape', async () => {
        const { onCancel } = renderDialog({ isSubmitting: true });

        expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Suspender cuenta' })).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('shows the error with role alert', () => {
        renderDialog({ error: 'No se pudo completar la acción.' });

        expect(screen.getByRole('alert')).toHaveTextContent('No se pudo completar la acción.');
    });
});
