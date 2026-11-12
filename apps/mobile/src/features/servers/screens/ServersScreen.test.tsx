import { render, screen, userEvent } from '@testing-library/react-native';
import type { Server } from '@discordia/api';
import { UnreadContext, type ChannelUnreadEntry, type UnreadState } from '@discordia/core';
import { serversService } from '@/shared/api';
import { ServersScreen } from './ServersScreen';

jest.mock('@/shared/api', () => ({ serversService: { getServers: jest.fn(), createServer: jest.fn() } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/shared/hooks/useLiveRefresh', () => ({ useLiveRefresh: () => undefined }));

const server = (id: string, name: string): Server => ({
  id,
  name,
  description: null,
  owner_id: 'owner',
  avatar_url: null,
  created_at: '2026-10-01T00:00:00Z',
  my_permissions: 0,
  my_permission_names: [],
  channels: [],
});

const entry = (serverId: string, overrides: Partial<ChannelUnreadEntry> = {}): ChannelUnreadEntry => ({
  serverId,
  lastMessageId: 'm2',
  lastMessageAt: '2026-11-02T12:02:00Z',
  lastReadMessageId: null,
  lastReadAt: null,
  unread: true,
  mentionCount: 0,
  ...overrides,
});

const markAllRead = jest.fn();

const renderScreen = async (state: UnreadState) => {
  await render(
    <UnreadContext.Provider value={{ state, setActiveChannel: jest.fn(), markAllRead }}>
      <ServersScreen />
    </UnreadContext.Provider>,
  );
  await screen.findByText('Alfa');
};

describe('ServersScreen unread marks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    markAllRead.mockResolvedValue(undefined);
    jest.mocked(serversService.getServers).mockResolvedValue([server('s1', 'Alfa'), server('s2', 'Beta')]);
  });

  it('marks the server whenever any of its channels is unread (CA2 de SCRUM-75)', async () => {
    await renderScreen({ byChannel: { a: entry('s2', { unread: false }), b: entry('s2') } });

    expect(screen.getByLabelText('Mensajes sin leer en el servidor Beta')).toBeTruthy();
    expect(screen.queryByLabelText(/servidor Alfa/)).toBeNull();
  });

  it('does not mark a server whose channels are all read', async () => {
    await renderScreen({ byChannel: { a: entry('s1', { unread: false }) } });

    expect(screen.queryByLabelText(/sin leer/)).toBeNull();
  });

  it('marks everything as read from the header (CA2 de SCRUM-76)', async () => {
    const user = userEvent.setup();
    await renderScreen({ byChannel: { a: entry('s1') } });

    await user.press(screen.getByLabelText('Marcar todo como leído'));

    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('disables the action when nothing is unread', async () => {
    const user = userEvent.setup();
    await renderScreen({ byChannel: { a: entry('s1', { unread: false }) } });

    await user.press(screen.getByLabelText('Marcar todo como leído'));

    expect(markAllRead).not.toHaveBeenCalled();
  });

  it('survives a failed mark-all without crashing', async () => {
    markAllRead.mockRejectedValue(new Error('boom'));
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    await renderScreen({ byChannel: { a: entry('s1') } });

    await user.press(screen.getByLabelText('Marcar todo como leído'));

    expect(markAllRead).toHaveBeenCalled();
    error.mockRestore();
  });
});
