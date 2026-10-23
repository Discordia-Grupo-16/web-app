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

const renderActions = async (isOwner: boolean) => {
  const onLeavingChange = jest.fn();
  const user = userEvent.setup();
  await render(<ServerActions server={server} isOwner={isOwner} onLeavingChange={onLeavingChange} />);
  return { user, onLeavingChange };
};

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

  it('shows the owner no actions: no leave and no delete', async () => {
    await renderActions(true);

    expect(screen.queryByText('Abandonar servidor')).not.toBeOnTheScreen();
    expect(screen.queryByText('Eliminar servidor')).not.toBeOnTheScreen();
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
