import { render, screen, userEvent } from '@testing-library/react-native';
import type { OwnershipError } from '@discordia/core';
import { TransferOwnershipDialog } from './TransferOwnershipDialog';

const renderDialog = async (overrides: { busy?: boolean; error?: OwnershipError | null } = {}) => {
  const callbacks = { onConfirm: jest.fn(), onRetry: jest.fn(), onClose: jest.fn() };
  await render(
    <TransferOwnershipDialog
      visible
      toName="Beto"
      serverName="Grupo 16"
      busy={overrides.busy ?? false}
      error={overrides.error ?? null}
      {...callbacks}
    />,
  );
  return { ...callbacks, user: userEvent.setup() };
};

describe('TransferOwnershipDialog', () => {
  it('names the member and the server, and says what the owner gives up', async () => {
    await renderDialog();

    expect(
      screen.getByText('¿Querés proponerle a Beto que sea el nuevo dueño de «Grupo 16»? Beto tiene que aceptar. Cuando acepte, vas a dejar de ser el dueño.'),
    ).toBeOnTheScreen();
  });

  it('proposes on confirm', async () => {
    const { onConfirm, user } = await renderDialog();

    await user.press(screen.getByText('Enviar propuesta'));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not propose nor close while proposing', async () => {
    const { onConfirm, onClose, user } = await renderDialog({ busy: true });

    await user.press(screen.getByText('Enviar propuesta'));
    await user.press(screen.getByText('Cancelar'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a lost connection and retries', async () => {
    const { onRetry, onConfirm, user } = await renderDialog({ error: { kind: 'network' } });

    expect(screen.getByText('No hay conexión.')).toBeOnTheScreen();
    await user.press(screen.getByText('Reintentar'));

    expect(onRetry).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('names who the pending transfer is for when there already is one', async () => {
    await renderDialog({ error: { kind: 'already-pending', toUserId: 'caro', toName: 'Caro' } });

    expect(screen.getByText('Ya hay una transferencia pendiente a Caro')).toBeOnTheScreen();
  });

  it('closes from cancel', async () => {
    const { onClose, user } = await renderDialog();

    await user.press(screen.getByText('Cancelar'));

    expect(onClose).toHaveBeenCalled();
  });
});
