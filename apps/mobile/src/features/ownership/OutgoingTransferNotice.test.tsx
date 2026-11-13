import { render, screen, userEvent } from '@testing-library/react-native';
import type { OutgoingTransferView } from '@discordia/core';
import { OutgoingTransferNotice } from './OutgoingTransferNotice';

const about = { toUserId: 'beto', toName: 'Beto', toNameLoading: false, createdAt: '2026-11-05T10:00:00Z' };

const renderNotice = async (view: OutgoingTransferView, busy = false) => {
  const callbacks = { onCancel: jest.fn(), onDismissRejection: jest.fn() };
  await render(<OutgoingTransferNotice view={view} busy={busy} {...callbacks} />);
  return { ...callbacks, user: userEvent.setup() };
};

describe('OutgoingTransferNotice', () => {
  it('renders nothing without a transfer to show', async () => {
    await renderNotice({ kind: 'none' });

    expect(screen.toJSON()).toBeNull();
  });

  it('shows the pending transfer and cancels it', async () => {
    const { onCancel, user } = await renderNotice({ kind: 'pending', ...about });

    expect(screen.getByText('Transferencia pendiente a Beto')).toBeOnTheScreen();
    await user.press(screen.getByText('Cancelar'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('shows the rejection and closes it', async () => {
    const { onDismissRejection, user } = await renderNotice({ kind: 'rejected', ...about });

    expect(screen.getByText('Beto rechazó la transferencia')).toBeOnTheScreen();
    await user.press(screen.getByText('Cerrar'));

    expect(onDismissRejection).toHaveBeenCalled();
  });

  it('does not cancel while it runs', async () => {
    const { onCancel, user } = await renderNotice({ kind: 'pending', ...about }, true);

    await user.press(screen.getByText('Cancelar'));

    expect(onCancel).not.toHaveBeenCalled();
  });
});
