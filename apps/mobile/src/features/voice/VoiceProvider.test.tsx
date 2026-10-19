import { act, render, screen, userEvent } from '@testing-library/react-native';
import { AppState, Pressable, Text, type AppStateStatus } from 'react-native';
import { useVoice, type VoiceRoomAdapter } from '@discordia/core';
import { loadVoice } from './loadVoice';
import { VoiceProvider } from './VoiceProvider';

jest.mock('@/shared/api', () => ({
  voiceService: {
    createVoiceToken: jest.fn(async (id: string) => ({ token: 't', url: 'wss://x', roomName: id, expiresAt: '' })),
  },
}));
jest.mock('./loadVoice', () => ({ loadVoice: jest.fn() }));

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
const changeAppState = (state: AppStateStatus) => act(() => appStateListeners.forEach((l) => l(state)));

const makeAdapter = () =>
  ({
    connect: jest.fn(async () => undefined),
    disconnect: jest.fn(async () => undefined),
    enableMicrophone: jest.fn<ReturnType<VoiceRoomAdapter['enableMicrophone']>, []>(async () => 'ok'),
    onDisconnected: () => () => undefined,
    onParticipantsChanged: () => () => undefined,
    onReconnectingChanged: () => () => undefined,
  }) satisfies VoiceRoomAdapter;

const Status = () => {
  const { call, available, join } = useVoice();
  return (
    <>
      <Text>{available ? 'available' : 'unavailable'}</Text>
      <Text>{call.status === 'idle' ? 'idle' : `${call.channel.id} ${call.status === 'disconnected' ? call.reason : call.status}`}</Text>
      <Pressable onPress={() => join({ id: 'c1', serverId: 's1', name: 'General' })}>
        <Text>Unirse</Text>
      </Pressable>
      <Pressable onPress={() => join({ id: 'c2', serverId: 's1', name: 'Juegos' })}>
        <Text>Cambiar</Text>
      </Pressable>
    </>
  );
};

const renderProvider = () =>
  render(
    <VoiceProvider>
      <Status />
    </VoiceProvider>,
  );

describe('VoiceProvider', () => {
  beforeEach(() => {
    appStateListeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListeners.push(listener);
      return { remove: () => undefined };
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reports voice as unavailable in Expo Go', async () => {
    jest.mocked(loadVoice).mockReturnValue(null);
    await renderProvider();

    expect(screen.getByText('unavailable')).toBeTruthy();
  });

  it('cuts the call when the app goes to the background', async () => {
    const adapter = makeAdapter();
    jest.mocked(loadVoice).mockReturnValue(adapter);
    await renderProvider();
    await userEvent.setup().press(screen.getByText('Unirse'));
    expect(await screen.findByText('c1 connected')).toBeTruthy();

    await changeAppState('background');

    expect(await screen.findByText('c1 app_backgrounded')).toBeTruthy();
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it('does not cut the call while the microphone permission dialog is open', async () => {
    const adapter = makeAdapter();
    let answer: (result: 'ok') => void = () => undefined;
    jest.mocked(loadVoice).mockReturnValue(adapter);
    await renderProvider();
    const user = userEvent.setup();
    await user.press(screen.getByText('Unirse'));
    expect(await screen.findByText('c1 connected')).toBeTruthy();
    adapter.enableMicrophone.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));

    await user.press(screen.getByText('Cambiar'));
    await changeAppState('background');
    await act(async () => answer('ok'));

    expect(await screen.findByText('c2 connected')).toBeTruthy();
    // Only the switch itself leaves the previous room: the new one is never cut.
    expect(adapter.disconnect).toHaveBeenCalledTimes(1);
  });
});
