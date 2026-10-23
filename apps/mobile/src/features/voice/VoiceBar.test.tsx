import { render as rntlRender, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useVoice, VOICE_DISCONNECT_TEXTS, type VoiceChannelRef } from '@discordia/core';
import { voiceValue } from './testing';
import { VoiceBar } from './VoiceBar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@discordia/core', () => ({ ...jest.requireActual('@discordia/core'), useVoice: jest.fn() }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 24 } };
const render = (ui: React.ReactElement) => rntlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

const general: VoiceChannelRef = { id: 'c1', serverId: 's1', name: 'General' };
const juegos: VoiceChannelRef = { id: 'c2', serverId: 's1', name: 'Juegos' };

const connected = (extra: { reconnecting?: boolean } = {}) => ({
  status: 'connected' as const,
  channel: general,
  micAvailable: true,
  micBlocked: false,
  muted: false,
  reconnecting: extra.reconnecting ?? false,
  participants: [],
});

describe('VoiceBar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows nothing without a call', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue());
    await render(<VoiceBar />);

    expect(screen.queryByText('Conectado a')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes you back to the call screen', async () => {
    jest.mocked(useVoice).mockReturnValue(
      voiceValue({
        call: { status: 'connected', channel: general, micAvailable: true, micBlocked: false, muted: false, reconnecting: false, participants: [] },
      }),
    );
    await render(<VoiceBar />);

    expect(screen.getByText('General')).toBeTruthy();
    await userEvent.setup().press(screen.getByRole('link'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/server/[serverId]/channel/[channelId]',
      params: { serverId: 's1', channelId: 'c1', name: 'General', type: 'voice' },
    });
  });

  it('shows why the call ended until it is dismissed', async () => {
    const value = voiceValue({ call: { status: 'disconnected', channel: general, reason: 'app_backgrounded' } });
    jest.mocked(useVoice).mockReturnValue(value);
    await render(<VoiceBar />);

    expect(screen.getByRole('alert')).toHaveTextContent(VOICE_DISCONNECT_TEXTS.app_backgrounded);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(value.dismiss).toHaveBeenCalled();
  });

  it('leaves the call without opening it (CA1 de SCRUM-52, Salir de canal de voz)', async () => {
    const value = voiceValue({ call: connected() });
    jest.mocked(useVoice).mockReturnValue(value);
    await render(<VoiceBar />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Salir de la llamada' }));

    expect(value.leave).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('waits for a join in progress before letting the user leave', async () => {
    const value = voiceValue({ call: connected(), attempt: { status: 'connecting', channel: juegos } });
    jest.mocked(useVoice).mockReturnValue(value);
    await render(<VoiceBar />);

    const leave = screen.getByRole('button', { name: 'Salir de la llamada' });
    expect(leave).toBeDisabled();
    await userEvent.setup().press(leave);
    expect(value.leave).not.toHaveBeenCalled();
  });

  it('shows that the call is reconnecting', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ call: connected({ reconnecting: true }) }));
    await render(<VoiceBar />);

    expect(screen.getByText('Reconectando…')).toBeTruthy();
    expect(screen.queryByText('Conectado a')).toBeNull();
    expect(screen.getByRole('button', { name: 'Salir de la llamada' })).toBeEnabled();
  });

  it.each(['connection_lost', 'app_backgrounded'] as const)('offers to rejoin after %s', async (reason) => {
    const value = voiceValue({ call: { status: 'disconnected', channel: general, reason } });
    jest.mocked(useVoice).mockReturnValue(value);
    await render(<VoiceBar />);

    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a unirse' }));

    expect(value.join).toHaveBeenCalledWith(general);
  });

  it.each(['other_device', 'kicked'] as const)('does not offer to rejoin after %s', async (reason) => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ call: { status: 'disconnected', channel: general, reason } }));
    await render(<VoiceBar />);

    expect(screen.queryByRole('button', { name: 'Volver a unirse' })).toBeNull();
  });
});
