import { act, render, screen } from '@testing-library/react-native';
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
// The refresh the screen gives for the notices of the server, so a test can say one arrived.
let mockRefresh: () => void = () => undefined;
jest.mock('@/shared/hooks/useLiveRefresh', () => ({
  useLiveRefresh: (options: { resources: string[]; refresh: () => void }) => {
    if (options.resources.includes('permissions')) mockRefresh = options.refresh;
  },
}));
jest.mock('@/shared/hooks/useScreenVisible', () => ({ useScreenVisible: () => mockVisible }));
jest.mock('../components/ChatScreen', () => ({
  ChatScreen: ({ canSendMessages, mutedUntil }: { canSendMessages: boolean; mutedUntil?: string | null }) => (
    <>
      <MockText>chat</MockText>
      <MockText>{canSendMessages ? 'puede escribir' : 'no puede escribir'}</MockText>
      {mutedUntil ? <MockText>{`silenciado hasta ${mutedUntil}`}</MockText> : null}
    </>
  ),
}));

const channel: Channel = {
  id: 'c1',
  server_id: 'srv',
  name: 'general',
  type: 'text',
  topic: null,
  category_id: null,
  position: 0,
  created_at: '2026-10-01T00:00:00Z',
};

const server: Server = {
  id: 'srv',
  name: 'Discordia',
  description: null,
  owner_id: 'owner',
  avatar_url: null,
  banner_url: null,
  created_at: '2026-10-01T00:00:00Z',
  my_permissions: VIEW_CHANNEL | SEND_MESSAGES,
  my_permission_names: [],
  my_muted_until: null,
  channels: [channel],
  categories: [],
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

describe('ChannelScreen and a moderator mute (SCRUM-71)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVisible = true;
  });

  it('with the mute on, blocks the composer even with SEND_MESSAGES and gives it the hour', async () => {
    const until = '2099-01-01T15:30:00Z';
    jest.mocked(serversService.getServer).mockResolvedValue({ ...server, my_muted_until: until });

    await renderScreen();

    expect(screen.getByText('no puede escribir')).toBeOnTheScreen();
    expect(screen.getByText(`silenciado hasta ${until}`)).toBeOnTheScreen();
  });

  it('with the mute already over, the composer is usable', async () => {
    jest.mocked(serversService.getServer).mockResolvedValue({ ...server, my_muted_until: '2020-01-01T15:30:00Z' });

    await renderScreen();

    expect(screen.getByText('puede escribir')).toBeOnTheScreen();
    expect(screen.queryByText(/silenciado hasta/)).toBeNull();
  });

  it('frees the composer by itself when the mute ends, with nothing from the server', async () => {
    const until = new Date(Date.now() + 1200).toISOString();
    jest.mocked(serversService.getServer).mockResolvedValue({ ...server, my_muted_until: until });
    await renderScreen();
    expect(screen.getByText('no puede escribir')).toBeOnTheScreen();

    expect(await screen.findByText('puede escribir', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.queryByText(/silenciado hasta/)).toBeNull();
  });

  it('gets muted when the permissions notice arrives, without leaving the channel', async () => {
    jest.mocked(serversService.getServer).mockResolvedValue(server);
    await renderScreen();
    expect(screen.getByText('puede escribir')).toBeOnTheScreen();

    jest.mocked(serversService.getServer).mockResolvedValue({ ...server, my_muted_until: '2099-01-01T15:30:00Z' });
    await act(async () => mockRefresh());

    expect(await screen.findByText('no puede escribir')).toBeOnTheScreen();
  });
});
