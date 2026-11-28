import { render, screen, userEvent } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { useVoice, VoiceSpeakersContext, type ChannelParticipantView } from '@discordia/core';
import { voiceValue } from './testing';
import { VoiceCallGrid } from './VoiceCallGrid';

jest.mock('@discordia/core', () => ({ ...jest.requireActual('@discordia/core'), useVoice: jest.fn() }));

const view = (userId: string, name: string, extra: Partial<ChannelParticipantView> = {}): ChannelParticipantView => ({
  userId,
  name,
  userAvatar: '',
  loading: false,
  muted: false,
  cameraOn: false,
  isSelf: false,
  ...extra,
});

const setWidth = (width: number) => Dimensions.set({ window: { width, height: 800, scale: 1, fontScale: 1 } });

describe('VoiceCallGrid', () => {
  beforeEach(() => {
    jest.mocked(useVoice).mockReturnValue(voiceValue());
    setWidth(400);
  });

  it('is labelled for the call and draws one tile per participant', async () => {
    await render(<VoiceCallGrid participants={[view('u1', 'Ana'), view('u2', 'Beto')]} />);

    expect(screen.getByLabelText('Participantes de la llamada')).toBeTruthy();
    expect(screen.getByTestId('voice-tile-u1')).toBeTruthy();
    expect(screen.getByTestId('voice-tile-u2')).toBeTruthy();
  });

  it('gives a tile alone the whole width of the screen', async () => {
    await render(<VoiceCallGrid participants={[view('u1', 'Ana')]} />);

    expect(screen.getByTestId('voice-tile-u1')).toHaveStyle({ width: 368, height: 491 });
  });

  it('puts two tiles side by side', async () => {
    await render(<VoiceCallGrid participants={[view('u1', 'Ana'), view('u2', 'Beto')]} />);

    expect(screen.getByTestId('voice-tile-u1')).toHaveStyle({ width: 180, height: 240 });
    expect(screen.getByTestId('voice-tile-u2')).toHaveStyle({ width: 180, height: 240 });
  });

  it('marks who is speaking, and nobody who is muted (S8)', async () => {
    await render(
      <VoiceSpeakersContext.Provider value={new Set(['u1', 'u2'])}>
        <VoiceCallGrid participants={[view('u1', 'Ana'), view('u2', 'Beto', { muted: true })]} />
      </VoiceSpeakersContext.Provider>,
    );

    expect(screen.getByTestId('voice-speaking-u1')).toBeTruthy();
    expect(screen.queryByTestId('voice-speaking-u2')).toBeNull();
  });

  it('marks nobody without a speakers provider', async () => {
    await render(<VoiceCallGrid participants={[view('u1', 'Ana')]} />);

    expect(screen.queryByTestId('voice-speaking-u1')).toBeNull();
  });

  it('shows the grey ring of someone who speaks while muted on this device', async () => {
    jest.mocked(useVoice).mockReturnValue(voiceValue({ locallyMuted: new Set(['u1']) }));
    await render(
      <VoiceSpeakersContext.Provider value={new Set(['u1'])}>
        <VoiceCallGrid participants={[view('u1', 'Ana')]} />
      </VoiceSpeakersContext.Provider>,
    );

    expect(screen.getByTestId('voice-speaking-muted-u1')).toBeTruthy();
  });

  it('has the local mute button on the tiles of the others and not on the own (SCRUM-57)', async () => {
    const value = voiceValue();
    jest.mocked(useVoice).mockReturnValue(value);
    await render(<VoiceCallGrid participants={[view('u1', 'Ana'), view('me', 'Milton', { isSelf: true })]} />);

    expect(screen.queryByTestId('voice-local-mute-me')).toBeNull();
    await userEvent.setup().press(screen.getByTestId('voice-local-mute-u1'));

    expect(value.toggleLocalMute).toHaveBeenCalledTimes(1);
    expect(value.toggleLocalMute).toHaveBeenCalledWith('u1');
  });
});
