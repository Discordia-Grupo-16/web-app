import { render, screen } from '@testing-library/react-native';
import { VoiceSpeakersContext, type ChannelParticipantView } from '@discordia/core';
import { VoiceCallParticipantList } from './VoiceCallParticipantList';

const participants: ChannelParticipantView[] = [
  { userId: 'u1', name: 'Ana', loading: false, muted: false },
  { userId: 'u2', name: 'Beto', loading: false, muted: false },
];

describe('VoiceCallParticipantList', () => {
  it('highlights who the speakers context says is speaking', async () => {
    await render(
      <VoiceSpeakersContext.Provider value={new Set(['u1'])}>
        <VoiceCallParticipantList participants={participants} />
      </VoiceSpeakersContext.Provider>,
    );

    expect(screen.getByTestId('voice-speaking-u1')).toBeTruthy();
    expect(screen.queryByTestId('voice-speaking-u2')).toBeNull();
  });

  it('highlights nobody without a provider', async () => {
    await render(<VoiceCallParticipantList participants={participants} />);

    expect(screen.queryByTestId(/voice-speaking-/)).toBeNull();
  });
});
