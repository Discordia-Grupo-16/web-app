import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { OutgoingTransferView } from '@discordia/core';
import { OutgoingTransferNotice } from './OutgoingTransferNotice';

const about = { toUserId: 'beto', toName: 'Beto', toNameLoading: false, createdAt: '2026-11-05T10:00:00Z' };

const renderNotice = (view: OutgoingTransferView, busy = false) => {
    const callbacks = { onCancel: vi.fn(), onDismissRejection: vi.fn() };
    const { container } = render(<OutgoingTransferNotice view={view} busy={busy} {...callbacks} />);
    return { ...callbacks, container };
};

describe('OutgoingTransferNotice', () => {
    it('renders nothing without a transfer to show', () => {
        const { container } = renderNotice({ kind: 'none' });

        expect(container).toBeEmptyDOMElement();
    });

    it('shows the pending transfer and cancels it', async () => {
        const { onCancel } = renderNotice({ kind: 'pending', ...about });

        expect(screen.getByText('Transferencia pendiente a Beto')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onCancel).toHaveBeenCalled();
    });

    it('shows the rejection and closes it', async () => {
        const { onDismissRejection } = renderNotice({ kind: 'rejected', ...about });

        expect(screen.getByText('Beto rechazó la transferencia')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

        expect(onDismissRejection).toHaveBeenCalled();
    });

    it('disables cancelling while it runs', () => {
        renderNotice({ kind: 'pending', ...about }, true);

        expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    });
});
