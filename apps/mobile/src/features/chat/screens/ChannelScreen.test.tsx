import { render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import type { Channel, Server } from '@discordia/api';
import { SEND_MESSAGES, UnreadContext, VIEW_CHANNEL } from '@discordia/core';
import { serversService } from '@/shared/api';
import { ChannelScreen } from './ChannelScreen';

let mockVisible = true;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ serverId: 'srv', channelId: 'c1', name: 'general' }),
  useNavigation: () => ({ setOptions: jest.fn() }),
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('@/shared/api', () => ({ serversService: { getServer: jest.fn() } }));
jest.mock('@/shared/hooks/useLiveRefresh', () => ({ useLiveRefresh: () => undefined }));
jest.mock('@/shared/hooks/useScreenVisible', () => ({ useScreenVisible: () => mockVisible }));
jest.mock('../components/ChatScreen', () => ({ ChatScreen: () => <MockText>chat</MockText> }));

const channel: Channel = {
  id: 'c1',
  server_id: 'srv',
  name: 'general',
  type: 'text',
  topic: null,
  position: 0,
  created_at: '2026-10-01T00:00:00Z',
};

const server: Server = {
  id: 'srv',
  name: 'Discordia',
  description: null,
  owner_id: 'owner',
  avatar_url: null,
  created_at: '2026-10-01T00:00:00Z',
  my_permissions: VIEW_CHANNEL | SEND_MESSAGES,
  my_permission_names: [],
  channels: [channel],
};

const setActiveChannel = jest.fn();

const renderScreen = async () => {
  await render(
    <UnreadContext.Provider value={{ state: { byChannel: {} }, setActiveChannel, markAllRead: jest.fn() }}>
      <ChannelScreen />
    </UnreadContext.Provider>,
  );
  await screen.findByText('chat');
};

describe('ChannelScreen marks the channel as read (CA1 de SCRUM-76)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVisible = true;
    jest.mocked(serversService.getServer).mockResolvedValue(server);
  });

  it('reports the open channel as being read while the screen is visible', async () => {
    await renderScreen();

    expect(setActiveChannel).toHaveBeenCalledWith('c1', true);
  });

  // Focus lost or app in the background: what arrives stays unread until the user comes back.
  it('does not read it while the screen is not visible', async () => {
    mockVisible = false;

    await renderScreen();

    expect(setActiveChannel).not.toHaveBeenCalledWith('c1', true);
    expect(setActiveChannel).toHaveBeenCalledWith('c1', false);
  });
});
