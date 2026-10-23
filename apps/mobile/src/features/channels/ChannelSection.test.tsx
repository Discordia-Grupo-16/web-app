import { Alert, Text } from 'react-native';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { Channel } from '@discordia/api';
import { channelsService } from '@/shared/api';
import { ChannelSection } from './ChannelSection';

const mockPush = jest.fn();

jest.mock('@/shared/api', () => ({
  channelsService: { createChannel: jest.fn(), updateChannel: jest.fn(), deleteChannel: jest.fn() },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const channel = (id: string, name: string, type: Channel['type'] = 'text'): Channel => ({
  id,
  server_id: 'srv',
  name,
  type,
  topic: null,
  position: 0,
  created_at: '2026-10-01T00:00:00Z',
});

const general = channel('c1', 'general');
const lobby = channel('c2', 'lobby', 'voice');

// onChannelsChange receives an updater: apply it to the channels the section was given.
const renderSection = async (canManage = true, renderBelowChannel?: (ch: Channel) => React.ReactNode) => {
  const onChannelsChange = jest.fn();
  const user = userEvent.setup();
  await render(
    <ChannelSection
      serverId="srv"
      channels={[general, lobby]}
      canManage={canManage}
      onChannelsChange={onChannelsChange}
      renderBelowChannel={renderBelowChannel}
    />,
  );
  const applied = () =>
    onChannelsChange.mock.calls.reduce((list: Channel[], [update]) => update(list), [general, lobby]);
  return { user, onChannelsChange, applied };
};

// Presses the Alert button with the given text, as the user would in the native dialog.
const pressAlertButton = async (text: string) => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
  // The handler updates state after awaiting the request: run it inside act.
  await act(async () => {
    await buttons.find(b => b.text === text)?.onPress?.();
  });
};

describe('ChannelSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('lists text and voice channels', async () => {
    await renderSection();
    expect(screen.getByText('# general')).toBeOnTheScreen();
    expect(screen.getByText('🔊 lobby')).toBeOnTheScreen();
  });

  it('opens a text channel in the chat', async () => {
    const { user } = await renderSection();
    await user.press(screen.getByText('# general'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/server/[serverId]/channel/[channelId]',
      params: { serverId: 'srv', channelId: 'c1', name: 'general', type: 'text' },
    });
  });

  it('opens a voice channel in its call screen', async () => {
    const { user } = await renderSection();
    await user.press(screen.getByText('🔊 lobby'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/server/[serverId]/channel/[channelId]',
      params: { serverId: 'srv', channelId: 'c2', name: 'lobby', type: 'voice' },
    });
  });

  it('draws what it is given under each channel', async () => {
    await renderSection(true, (ch) => (ch.id === 'c2' ? <Text>Ana en la llamada</Text> : null));
    expect(screen.getByText('Ana en la llamada')).toBeOnTheScreen();
  });

  it('hides the management buttons for members who cannot manage', async () => {
    await renderSection(false);
    expect(screen.queryByText('+')).not.toBeOnTheScreen();
    expect(screen.queryByText('🗑')).not.toBeOnTheScreen();
  });

  it('creates a channel with a normalized name', async () => {
    const created = channel('c3', 'nuevo-canal');
    jest.mocked(channelsService.createChannel).mockResolvedValue(created);
    const { user, applied } = await renderSection();

    await user.press(screen.getAllByText('+')[0]);
    await user.type(screen.getByPlaceholderText('nuevo-canal'), 'Nuevo Canal');
    // The modal title is also "Crear canal": the button comes last.
    await user.press(screen.getAllByText('Crear canal').at(-1)!);

    expect(channelsService.createChannel).toHaveBeenCalledWith('srv', 'nuevo-canal', 'text');
    expect(applied()).toEqual([general, lobby, created]);
  });

  it('deletes a channel once the user confirms', async () => {
    jest.mocked(channelsService.deleteChannel).mockResolvedValue();
    const { user, applied } = await renderSection();

    await user.press(screen.getAllByText('🗑')[0]);
    expect(channelsService.deleteChannel).not.toHaveBeenCalled();
    await pressAlertButton('Eliminar');

    expect(channelsService.deleteChannel).toHaveBeenCalledWith('srv', 'c1');
    expect(applied()).toEqual([lobby]);
  });

  it('keeps the channel and reports the error when the delete fails', async () => {
    jest.mocked(channelsService.deleteChannel).mockRejectedValue({ response: { data: { detail: 'Sin permiso' } } });
    const { user, onChannelsChange } = await renderSection();

    await user.press(screen.getAllByText('🗑')[0]);
    await pressAlertButton('Eliminar');

    expect(Alert.alert).toHaveBeenLastCalledWith('Error', 'Sin permiso');
    expect(onChannelsChange).not.toHaveBeenCalled();
  });
});
