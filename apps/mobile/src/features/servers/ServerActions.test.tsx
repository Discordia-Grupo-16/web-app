import { Alert } from 'react-native';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { ServerActions } from './ServerActions';

const mockBack = jest.fn();

jest.mock('@/shared/api', () => ({ serversService: { leaveServer: jest.fn() } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));

const server: Server = {
  id: 'srv',
  name: 'Discordia',
  description: null,
  owner_id: 'owner',
  avatar_url: null,
  created_at: '2026-10-01T00:00:00Z',
  my_permissions: 7,
  my_permission_names: ['VIEW_CHANNEL', 'SEND_MESSAGES', 'CONNECT'],
  channels: [],
};

const pressAlertButton = async (text: string) => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
  // The handler updates state after awaiting the request: run it inside act.
  await act(async () => {
    await buttons.find(b => b.text === text)?.onPress?.();
  });
};

const onTransferRequested = jest.fn();

const renderActions = async (
  isOwner: boolean,
  { pendingTransferTo = null, onDeleteRequested }: { pendingTransferTo?: string | null; onDeleteRequested?: () => void } = {},
) => {
  const onLeavingChange = jest.fn();
  const user = userEvent.setup();
  await render(
    <ServerActions
      server={server}
      isOwner={isOwner}
      onLeavingChange={onLeavingChange}
      pendingTransferTo={pendingTransferTo}
      onTransferRequested={onTransferRequested}
      onDeleteRequested={onDeleteRequested}
    />,
  );
  return { user, onLeavingChange };
};

const OWNER_MESSAGE = 'Para abandonar el servidor, primero transferí el servidor o eliminalo.';
const lastAlertButtons = () => (jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? []).map(b => b.text);

describe('ServerActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('lets a member leave', async () => {
    jest.mocked(serversService.leaveServer).mockResolvedValue();
    const { user, onLeavingChange } = await renderActions(false);
    expect(screen.queryByText('Eliminar servidor')).not.toBeOnTheScreen();

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');

    expect(onLeavingChange).toHaveBeenCalledWith(true);
    expect(serversService.leaveServer).toHaveBeenCalledWith('srv');
    expect(mockBack).toHaveBeenCalled();
  });

  it('offers the owner to leave, but asks to transfer the ownership first', async () => {
    const { user } = await renderActions(true);

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');

    expect(serversService.leaveServer).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenLastCalledWith('Abandonar servidor', OWNER_MESSAGE, expect.any(Array));
    expect(lastAlertButtons()).toContain('Transferir servidor');
  });

  it('names the recipient of the pending transfer', async () => {
    const { user } = await renderActions(true, { pendingTransferTo: 'Beto' });

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');

    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Abandonar servidor',
      `${OWNER_MESSAGE} Ya hay una transferencia pendiente a Beto.`,
      expect.any(Array),
    );
  });

  it('takes the owner to transfer the ownership', async () => {
    const { user } = await renderActions(true);

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');
    await pressAlertButton('Transferir servidor');

    expect(onTransferRequested).toHaveBeenCalled();
  });

  it('offers deleting the server only when it can be deleted', async () => {
    const onDeleteRequested = jest.fn();
    const { user } = await renderActions(true, { onDeleteRequested });

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');
    await pressAlertButton('Eliminar servidor');

    expect(onDeleteRequested).toHaveBeenCalled();
  });

  it('does not offer deleting the server without the way to do it', async () => {
    const { user } = await renderActions(true);

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');

    expect(lastAlertButtons()).not.toContain('Eliminar servidor');
  });

  it('shows the owner message when the backend says the user is the owner', async () => {
    jest.mocked(serversService.leaveServer).mockRejectedValue({ response: { status: 409 } });
    const { user } = await renderActions(false);

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');

    expect(Alert.alert).toHaveBeenLastCalledWith('Abandonar servidor', OWNER_MESSAGE, expect.any(Array));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('does nothing when the user cancels', async () => {
    const { user } = await renderActions(false);

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Cancelar');

    expect(serversService.leaveServer).not.toHaveBeenCalled();
  });

  it('stays on the server and reports the error when leaving fails', async () => {
    jest.mocked(serversService.leaveServer).mockRejectedValue(new Error('network'));
    const { user, onLeavingChange } = await renderActions(false);

    await user.press(screen.getByText('Abandonar servidor'));
    await pressAlertButton('Salir');

    expect(onLeavingChange).toHaveBeenLastCalledWith(false);
    expect(Alert.alert).toHaveBeenLastCalledWith('Error', 'No se pudo abandonar el servidor.');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
