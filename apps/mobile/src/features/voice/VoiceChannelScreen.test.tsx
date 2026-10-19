import { render, screen, userEvent } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { useVoice, VOICE_TEXTS, type VoiceChannelRef, type VoiceJoinError } from '@discordia/core';
import { voiceValue } from './testing';
import { VOICE_NEEDS_DEV_BUILD, VoiceChannelScreen } from './VoiceChannelScreen';

jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useVoice: jest.fn(),
  useVoiceCallParticipants: jest.fn(() => [{ userId: 'u1', name: 'Ana', loading: false, muted: true }]),
}));

const general: VoiceChannelRef = { id: 'c1', serverId: 's1', name: 'General' };
const other: VoiceChannelRef = { id: 'c2', serverId: 's1', name: 'Juegos' };

const connectedTo = (channel: VoiceChannelRef, extra: { micAvailable?: boolean; micBlocked?: boolean } = {}) => ({
  status: 'connected' as const,
  channel,
  micAvailable: extra.micAvailable ?? true,
  micBlocked: extra.micBlocked ?? false,
  muted: !(extra.micAvailable ?? true),
  reconnecting: false,
  participants: [],
});

describe('VoiceChannelScreen', () => {
  beforeEach(() => jest.mocked(useVoice).mockReturnValue(voiceValue()));

  it('offers to join without connecting on open', async () => {
    const value = voiceValue();
    jest.mocked(useVoice).mockReturnValue(value);
    await render(<VoiceChannelScreen channel={general} />);

    expect(value.join).not.toHaveBeenCalled();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Unirse' }));
    expect(value.join).toHaveBeenCalledWith(general);
  });

  it('shows that it is connecting', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ attempt: { status: 'connecting', channel: general } }));
    await render(<VoiceChannelScreen channel={general} />);

    expect(screen.getByRole('button', { name: VOICE_TEXTS.connecting })).toBeDisabled();
  });

  it.each([
    ['forbidden', 'No tenés permiso para unirte a este canal.', false],
    ['not-found', 'Este canal ya no existe.', false],
    ['not-voice', 'Este canal no es de voz.', false],
    ['unavailable', 'La voz no está disponible en este momento.', true],
    ['network', 'No hay conexión.', true],
  ] as const)('shows the %s error, with retry only when it can work', async (error: VoiceJoinError, text, retryable) => {
    const value = voiceValue({ attempt: { status: 'failed', channel: general, error } });
    jest.mocked(useVoice).mockReturnValue(value);
    await render(<VoiceChannelScreen channel={general} />);

    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByRole('button', { name: 'Unirse' })).toBeNull();
    const retry = screen.queryByRole('button', { name: 'Reintentar' });
    expect(Boolean(retry)).toBe(retryable);
    if (retry) {
      await userEvent.setup().press(retry);
      expect(value.retry).toHaveBeenCalled();
    }
  });

  it('keeps offering to join while the call is in another channel', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(other) }));
    await render(<VoiceChannelScreen channel={general} />);

    expect(screen.getByRole('button', { name: 'Unirse' })).toBeTruthy();
  });

  it('shows the call with its participants', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(general) }));
    await render(<VoiceChannelScreen channel={general} />);

    expect(screen.getByText('Estás en la llamada')).toBeTruthy();
    expect(screen.getByText('Ana')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('warns about joining without a microphone', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(general, { micAvailable: false }) }));
    await render(<VoiceChannelScreen channel={general} />);

    expect(screen.getByRole('alert')).toHaveTextContent(VOICE_TEXTS.noMic);
    expect(screen.queryByRole('button', { name: VOICE_TEXTS.openSettings })).toBeNull();
  });

  it('opens the app settings when the microphone is blocked, warning that it cuts the call', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    jest
      .mocked(useVoice)
      .mockReturnValue(voiceValue({ call: connectedTo(general, { micAvailable: false, micBlocked: true }) }));
    await render(<VoiceChannelScreen channel={general} />);

    expect(screen.getByText(VOICE_TEXTS.micBlockedMobileInCall)).toBeTruthy();
    await userEvent.setup().press(screen.getByRole('button', { name: VOICE_TEXTS.openSettings }));
    expect(openSettings).toHaveBeenCalled();
  });

  it('explains that voice needs the development build in Expo Go', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ available: false }));
    await render(<VoiceChannelScreen channel={general} />);

    expect(screen.getByText(VOICE_NEEDS_DEV_BUILD)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Unirse' })).toBeNull();
  });
});
