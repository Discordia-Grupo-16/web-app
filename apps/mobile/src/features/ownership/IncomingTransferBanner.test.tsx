import { Alert } from 'react-native';
import { act, render as rntlRender, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { OwnershipTransfer, PublicProfiles } from '@discordia/api';
import { ownershipSource } from '@/shared/api';
import { IncomingTransferBanner } from './IncomingTransferBanner';

jest.mock('@/shared/api', () => ({
  ownershipSource: {
    getServerTransfer: jest.fn(),
    proposeTransfer: jest.fn(),
    cancelTransfer: jest.fn(),
    acceptTransfer: jest.fn(),
    rejectTransfer: jest.fn(),
    listMyTransfers: jest.fn(),
    getServer: jest.fn(),
    getServers: jest.fn(),
  },
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };

const pending = (serverId: string, serverName: string): OwnershipTransfer => ({
  server_id: serverId,
  server_name: serverName,
  from_user_id: 'ana',
  to_user_id: 'beto',
  status: 'pending',
  created_at: '2026-11-05T10:00:00Z',
  resolved_at: null,
});

const profiles: PublicProfileSource = {
  getPublicProfiles: async (ids): Promise<PublicProfiles> =>
    new Map(ids.map((id) => [id, { id, name: 'Ana', avatarUrl: null, bio: null }] as const)),
  peekPublicProfile: () => undefined,
};

const renderBanner = () =>
  rntlRender(
    <SafeAreaProvider initialMetrics={metrics}>
      <PublicProfilesProvider source={profiles}>
        <IncomingTransferBanner />
      </PublicProfilesProvider>
    </SafeAreaProvider>,
  );

const pressAlertButton = async (text: string) => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
  await act(async () => {
    await buttons.find((b) => b.text === text)?.onPress?.();
  });
};

describe('IncomingTransferBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(ownershipSource.listMyTransfers).mockResolvedValue([pending('a', 'Grupo 16'), pending('b', 'Facultad')]);
    jest.mocked(ownershipSource.getServers).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    jest.mocked(ownershipSource.acceptTransfer).mockResolvedValue(undefined);
    jest.mocked(ownershipSource.rejectTransfer).mockResolvedValue(undefined);
  });

  it('shows one stripe per pending transfer, with who proposes it', async () => {
    await renderBanner();

    expect(await screen.findByText('Ana te propone ser el dueño de «Grupo 16»')).toBeOnTheScreen();
    expect(screen.getByText('Ana te propone ser el dueño de «Facultad»')).toBeOnTheScreen();
  });

  it('asks to confirm before accepting', async () => {
    const user = userEvent.setup();
    await renderBanner();
    await screen.findByText('Ana te propone ser el dueño de «Grupo 16»');

    await user.press(screen.getAllByText('Aceptar')[0]);

    expect(Alert.alert).toHaveBeenCalledWith('Transferir servidor', 'Vas a ser el dueño de «Grupo 16»', expect.any(Array));
    expect(ownershipSource.acceptTransfer).not.toHaveBeenCalled();
    await pressAlertButton('Aceptar');
    await waitFor(() => expect(ownershipSource.acceptTransfer).toHaveBeenCalledWith('a'));
  });

  it('rejects without asking to confirm', async () => {
    const user = userEvent.setup();
    await renderBanner();
    await screen.findByText('Ana te propone ser el dueño de «Grupo 16»');

    await user.press(screen.getAllByText('Rechazar')[0]);

    await waitFor(() => expect(ownershipSource.rejectTransfer).toHaveBeenCalledWith('a'));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('disables the buttons while an action is running', async () => {
    jest.mocked(ownershipSource.rejectTransfer).mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    await renderBanner();
    await screen.findByText('Ana te propone ser el dueño de «Grupo 16»');

    await user.press(screen.getAllByText('Rechazar')[0]);

    expect(await screen.findByText('Rechazando…')).toBeOnTheScreen();
    await user.press(screen.getAllByText('Aceptar')[0]);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('explains a transfer that is no longer available and lets the user close it', async () => {
    jest.mocked(ownershipSource.rejectTransfer).mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
    const user = userEvent.setup();
    await renderBanner();
    await screen.findByText('Ana te propone ser el dueño de «Grupo 16»');

    await user.press(screen.getAllByText('Rechazar')[0]);

    expect(await screen.findByText('Esta transferencia ya no está disponible')).toBeOnTheScreen();
    jest.mocked(ownershipSource.listMyTransfers).mockResolvedValue([pending('b', 'Facultad')]);
    await user.press(screen.getByText('Cerrar'));

    await waitFor(() => expect(screen.queryByText('Esta transferencia ya no está disponible')).not.toBeOnTheScreen());
    expect(screen.queryByText('Ana te propone ser el dueño de «Grupo 16»')).not.toBeOnTheScreen();
  });
});
