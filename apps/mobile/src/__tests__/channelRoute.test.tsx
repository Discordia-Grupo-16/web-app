import { act, render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import type { Channel, Server } from '@discordia/api';
import { CONNECT, SEND_MESSAGES, VIEW_CHANNEL } from '@discordia/core';
import { serversService } from '@/shared/api';
import ChannelRoute from '@/app/(app)/server/[serverId]/channel/[channelId]';

let mockParams: Record<string, string> = {};
let mockPollTicks: (() => void)[] = [];
// Stable, like the real ones: the route lists them as effect dependencies.
const mockNavigation = { setOptions: jest.fn() };
const mockRouter = { back: jest.fn(), canDismiss: jest.fn(() => true), dismissAll: jest.fn() };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  // useLiveRefresh follows the focus with it; this screen is never unfocused here.
  useFocusEffect: () => undefined,
}));
jest.mock('@/shared/api', () => ({ serversService: { getServer: jest.fn(), getServers: jest.fn() } }));
// The real poll runs on an interval while the screen is focused; here each tick is fired by hand.
jest.mock('@/shared/hooks/useFocusedPolling', () => ({
  useFocusedPolling: (tick: () => void) => {
    mockPollTicks.push(tick);
  },
}));
jest.mock('@/features/chat', () => ({ ChannelScreen: () => <MockText>pantalla del chat</MockText> }));
jest.mock('@/features/voice', () => ({
  VoiceChannelScreen: ({ channel, canJoin }: { channel: { name: string }; canJoin: boolean }) => (
    <MockText>{`voz de ${channel.name}: ${canJoin ? 'puede unirse' : 'sin permiso'}`}</MockText>
  ),
}));

const channel = (id: string, name: string, type: Channel['type']): Channel => ({
  id,
  server_id: 'srv',
  name,
  type,
  topic: null,
  category_id: null,
  position: 0,
  created_at: '2026-10-01T00:00:00Z',
});

const server = (myPermissions: number): Server => ({
  id: 'srv',
  name: 'Discordia',
  description: null,
  owner_id: 'owner',
  avatar_url: null, banner_url: null,
  created_at: '2026-10-01T00:00:00Z',
  my_permissions: myPermissions,
  my_permission_names: [],
  channels: [channel('c1', 'general', 'text'), channel('c2', 'lobby', 'voice')],
  categories: [],
});

describe('la ruta del canal de voz (CA2 de SCRUM-51, Unirse a canal de voz de servidor)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPollTicks = [];
    mockParams = { serverId: 'srv', channelId: 'c2', name: 'lobby', type: 'voice' };
    mockRouter.canDismiss.mockReturnValue(true);
    jest.mocked(serversService.getServers).mockResolvedValue([server(VIEW_CHANNEL | CONNECT)]);
  });

  it('pide el servidor aunque el tipo llegue por parámetro', async () => {
    jest.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | CONNECT));

    await render(<ChannelRoute />);

    expect(await screen.findByText('voz de lobby: puede unirse')).toBeTruthy();
    expect(serversService.getServer).toHaveBeenCalledWith('srv');
  });

  it('sin CONNECT no ofrece unirse', async () => {
    jest.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | SEND_MESSAGES));

    await render(<ChannelRoute />);

    expect(await screen.findByText('voz de lobby: sin permiso')).toBeTruthy();
  });

  it('muestra el spinner mientras cargan los permisos', async () => {
    jest.mocked(serversService.getServer).mockReturnValue(new Promise(() => undefined));

    await render(<ChannelRoute />);

    expect(screen.queryByText(/voz de lobby/)).toBeNull();
  });

  it('deja de ofrecer unirse cuando el poll trae el servidor sin CONNECT', async () => {
    jest.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | CONNECT));
    await render(<ChannelRoute />);
    await screen.findByText('voz de lobby: puede unirse');

    jest.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL));
    await act(async () => mockPollTicks[0]?.());

    expect(await screen.findByText('voz de lobby: sin permiso')).toBeTruthy();
  });

  it('sale del servidor cuando deja de aparecer en la lista de servidores', async () => {
    jest.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | CONNECT));
    jest.mocked(serversService.getServers).mockResolvedValue([]);
    await render(<ChannelRoute />);
    await screen.findByText('voz de lobby: puede unirse');

    await act(async () => mockPollTicks[1]?.());

    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
  });

  it('un canal de texto sigue yendo al chat', async () => {
    mockParams = { serverId: 'srv', channelId: 'c1', name: 'general', type: 'text' };

    await render(<ChannelRoute />);

    expect(screen.getByText('pantalla del chat')).toBeTruthy();
  });
});
