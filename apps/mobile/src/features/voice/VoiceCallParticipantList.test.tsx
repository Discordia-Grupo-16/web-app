import { render, screen, userEvent } from '@testing-library/react-native';
import { VOICE_TEXTS, VoiceContext, VoiceSpeakersContext, type ChannelParticipantView } from '@discordia/core';
import { voiceValue } from './testing';
import { VoiceCallParticipantList } from './VoiceCallParticipantList';

const participants: ChannelParticipantView[] = [
  { userId: 'u1', name: 'Ana', userAvatar: '', loading: false, muted: false, isSelf: false },
  { userId: 'me', name: 'Milton', userAvatar: '', loading: false, muted: false, isSelf: true },
  { userId: 'u3', name: 'Bob', userAvatar: '', loading: false, muted: false, isSelf: false },
];

describe('VoiceCallParticipantList', () => {
  it('highlights who the speakers context says is speaking', async () => {
    await render(
      <VoiceContext.Provider value={voiceValue()}>
        <VoiceSpeakersContext.Provider value={new Set(['u1'])}>
          <VoiceCallParticipantList participants={participants} />
        </VoiceSpeakersContext.Provider>
      </VoiceContext.Provider>,
    );

    expect(screen.getByTestId('voice-speaking-u1')).toBeTruthy();
    expect(screen.queryByTestId('voice-speaking-u3')).toBeNull();
  });

  it('highlights nobody without a speakers provider', async () => {
    await render(
      <VoiceContext.Provider value={voiceValue()}>
        <VoiceCallParticipantList participants={participants} />
      </VoiceContext.Provider>,
    );

    expect(screen.queryByTestId(/voice-speaking-/)).toBeNull();
  });

  describe('local mute (SCRUM-57, Silenciar a otro participante localmente)', () => {
    it('marks as muted locally whoever the voice context says', async () => {
      await render(
        <VoiceContext.Provider value={voiceValue({ locallyMuted: new Set(['u1']) })}>
          <VoiceCallParticipantList participants={participants} variant="roomy" />
        </VoiceContext.Provider>,
      );

      expect(screen.getByTestId('voice-local-mute-u1').props.accessibilityLabel).toBe(VOICE_TEXTS.localUnmute);
      expect(screen.getByTestId('voice-local-mute-u3').props.accessibilityLabel).toBe(VOICE_TEXTS.localMute);
    });

    it('calls toggleLocalMute of the voice context with the userId of the pressed row', async () => {
      const value = voiceValue();
      await render(
        <VoiceContext.Provider value={value}>
          <VoiceCallParticipantList participants={participants} variant="roomy" />
        </VoiceContext.Provider>,
      );

      await userEvent.setup().press(screen.getByTestId('voice-local-mute-u3'));

      expect(value.toggleLocalMute).toHaveBeenCalledTimes(1);
      expect(value.toggleLocalMute).toHaveBeenCalledWith('u3');
    });

    it('shows the grey ring when someone speaks while muted locally', async () => {
      await render(
        <VoiceContext.Provider value={voiceValue({ locallyMuted: new Set(['u1']) })}>
          <VoiceSpeakersContext.Provider value={new Set(['u1'])}>
            <VoiceCallParticipantList participants={participants} />
          </VoiceSpeakersContext.Provider>
        </VoiceContext.Provider>,
      );

      expect(screen.getByTestId('voice-speaking-muted-u1')).toBeTruthy();
    });
  });
});
