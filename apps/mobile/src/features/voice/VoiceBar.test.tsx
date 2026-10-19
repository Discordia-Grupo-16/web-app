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
});
