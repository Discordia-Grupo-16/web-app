import { render, screen, userEvent } from '@testing-library/react-native';
import type { RoleDeletionState } from '@discordia/core';
import type { Role } from '@discordia/api';
import { DeleteRoleDialog } from './DeleteRoleDialog';

jest.useFakeTimers();

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

const renderDialog = async (state: Exclude<RoleDeletionState, { stage: 'idle' }>) => {
  const handlers = { onConfirm: jest.fn(), onRetry: jest.fn(), onClose: jest.fn() };
  const user = userEvent.setup();
  await render(<DeleteRoleDialog state={state} {...handlers} />);
  return { ...handlers, user };
};

describe('DeleteRoleDialog', () => {
  it('nombra el rol y avisa que no se puede deshacer', async () => {
    const { onConfirm, user } = await renderDialog({ stage: 'confirming', role, deleting: false, error: null });

    expect(screen.getByText('¿Eliminar el rol Moderador? Esta acción no se puede deshacer.')).toBeOnTheScreen();
    await user.press(screen.getByText('Eliminar'));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('muestra que está eliminando y no deja confirmar de nuevo', async () => {
    const { onConfirm, user } = await renderDialog({ stage: 'confirming', role, deleting: true, error: null });

    await user.press(screen.getByText('Eliminando...'));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('explica la única fuente de ADMINISTRATOR, con solo cerrar', async () => {
    await renderDialog({ stage: 'blocked', role, blocker: 'sole-admin' });

    expect(
      screen.getByText('No podés eliminar este rol: es el que te da la administración del servidor'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Eliminar')).not.toBeOnTheScreen();
  });

  it('ofrece reintentar cuando falla el servicio', async () => {
    const { onRetry, user } = await renderDialog({ stage: 'confirming', role, deleting: false, error: { kind: 'service' } });

    expect(screen.getByText('No se pudo completar. Reintentá')).toBeOnTheScreen();
    await user.press(screen.getByText('Reintentar'));

    expect(onRetry).toHaveBeenCalled();
  });
});
