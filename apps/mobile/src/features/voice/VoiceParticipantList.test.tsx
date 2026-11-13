import { render, screen, userEvent } from '@testing-library/react-native';
import { VOICE_TEXTS, type ChannelParticipantView } from '@discordia/core';
import { VoiceParticipantList } from './VoiceParticipantList';

const participants: ChannelParticipantView[] = [
  { userId: 'u1', name: 'Ana', loading: false, muted: false },
  { userId: 'u2', name: 'Beto', loading: false, muted: true },
  { userId: 'u3', name: 'Cargando…', loading: true, muted: false },
];

describe('VoiceParticipantList', () => {
  it('shows every participant in order', async () => {
    await render(<VoiceParticipantList participants={participants} />);

    expect(screen.getAllByText(/Ana|Beto|Cargando…/).map((n) => n.props.children)).toEqual([
      'Ana',
      'Beto',
      'Cargando…',
    ]);
  });

  it('renders the participant avatar image instead of displaying its URL', async () => {
    const avatarUrl = 'https://cdn.example.com/ana.png';
    await render(<VoiceParticipantList participants={[{ ...participants[0], userAvatar: avatarUrl }]} />);

    expect(screen.getByTestId('voice-avatar-u1').props.source).toEqual({ uri: avatarUrl });
    expect(screen.queryByText(avatarUrl)).toBeNull();
  });

  it('is labelled for the channel, not only for the call: it also lists who is in a channel I am not in', async () => {
    await render(<VoiceParticipantList participants={participants} />);

    expect(screen.getByLabelText('Participantes del canal')).toBeTruthy();
    expect(screen.queryByLabelText('Participantes de la llamada')).toBeNull();
  });

  it('marks only the muted participants', async () => {
    await render(<VoiceParticipantList participants={participants} variant="roomy" />);

    expect(screen.getAllByLabelText('Silenciado')).toHaveLength(1);
  });

  describe('who is speaking (SCRUM-56, Indicador de quién está hablando)', () => {
    it('highlights only whoever speaks', async () => {
      await render(<VoiceParticipantList participants={participants} speakingIds={new Set(['u1', 'u3'])} />);

      expect(screen.getByTestId('voice-speaking-u1')).toBeTruthy();
      expect(screen.getByTestId('voice-speaking-u3')).toBeTruthy();
      expect(screen.queryByTestId('voice-speaking-u2')).toBeNull();
    });

    it('highlights nobody who is muted, even if the set has them', async () => {
      await render(<VoiceParticipantList participants={participants} speakingIds={new Set(['u2'])} />);

      expect(screen.queryByTestId('voice-speaking-u2')).toBeNull();
    });

    it('highlights nobody without speakingIds', async () => {
      await render(<VoiceParticipantList participants={participants} />);

      expect(screen.queryByTestId(/voice-speaking-/)).toBeNull();
    });

    it('keeps the order of the rows when who is speaking changes', async () => {
      const names = () => screen.getAllByText(/Ana|Beto|Cargando…/).map((n) => n.props.children);
      const { rerender } = await render(
        <VoiceParticipantList participants={participants} speakingIds={new Set(['u1'])} />,
      );
      const before = names();

      await rerender(<VoiceParticipantList participants={participants} speakingIds={new Set(['u3'])} />);

      expect(names()).toEqual(before);
      expect(screen.queryByTestId('voice-speaking-u1')).toBeNull();
      expect(screen.getByTestId('voice-speaking-u3')).toBeTruthy();
    });
  });

  describe('local mute (SCRUM-57, Silenciar a otro participante localmente)', () => {
    const call: ChannelParticipantView[] = [
      { userId: 'u1', name: 'Ana', loading: false, muted: false, isSelf: false },
      { userId: 'me', name: 'Milton', loading: false, muted: false, isSelf: true },
      { userId: 'u3', name: 'Bob', loading: false, muted: false, isSelf: false },
    ];

    it('offers the button on the rows of the others and not on the own one (CA6)', async () => {
      await render(<VoiceParticipantList participants={call} variant="roomy" onToggleLocalMute={jest.fn()} />);

      expect(screen.getByTestId('voice-local-mute-u1')).toBeTruthy();
      expect(screen.getByTestId('voice-local-mute-u3')).toBeTruthy();
      expect(screen.queryByTestId('voice-local-mute-me')).toBeNull();
      expect(screen.getAllByLabelText(VOICE_TEXTS.localMute)).toHaveLength(2);
    });

    it('calls the handler with the userId of the row (CA1)', async () => {
      const onToggleLocalMute = jest.fn();
      await render(<VoiceParticipantList participants={call} variant="roomy" onToggleLocalMute={onToggleLocalMute} />);

      await userEvent.setup().press(screen.getByTestId('voice-local-mute-u3'));

      expect(onToggleLocalMute).toHaveBeenCalledTimes(1);
      expect(onToggleLocalMute).toHaveBeenCalledWith('u3');
    });

    it('shows the button of whoever is muted as selected and offering to listen again (CA2)', async () => {
      await render(
        <VoiceParticipantList
          participants={call}
          variant="roomy"
          locallyMuted={new Set(['u1'])}
          onToggleLocalMute={jest.fn()}
        />,
      );

      const ana = screen.getByTestId('voice-local-mute-u1');
      expect(ana.props.accessibilityLabel).toBe(VOICE_TEXTS.localUnmute);
      expect(ana.props.accessibilityState).toEqual({ selected: true });
      const bob = screen.getByTestId('voice-local-mute-u3');
      expect(bob.props.accessibilityLabel).toBe(VOICE_TEXTS.localMute);
      expect(bob.props.accessibilityState).toEqual({ selected: false });
      // The icon inside the button has no label of its own: only the indicator carries that one.
      expect(screen.queryByLabelText(VOICE_TEXTS.locallyMuted)).toBeNull();
    });

    it('shows only the indicator, with no button, in the compact list', async () => {
      await render(<VoiceParticipantList participants={call} locallyMuted={new Set(['u1'])} onToggleLocalMute={jest.fn()} />);

      expect(screen.getAllByLabelText(VOICE_TEXTS.locallyMuted)).toHaveLength(1);
      expect(screen.queryByTestId(/voice-local-mute-/)).toBeNull();
    });

    it('shows both icons for someone with the microphone off and muted locally', async () => {
      const muted = [{ userId: 'u1', name: 'Ana', loading: false, muted: true, isSelf: false }];
      await render(<VoiceParticipantList participants={muted} locallyMuted={new Set(['u1'])} />);

      expect(screen.getByLabelText('Silenciado')).toBeTruthy();
      expect(screen.getByLabelText(VOICE_TEXTS.locallyMuted)).toBeTruthy();
    });

    it('draws the grey ring for whoever speaks while muted locally and the green one otherwise (CA3)', async () => {
      await render(
        <VoiceParticipantList participants={call} speakingIds={new Set(['u1', 'u3'])} locallyMuted={new Set(['u1'])} />,
      );

      expect(screen.getByTestId('voice-speaking-muted-u1')).toBeTruthy();
      expect(screen.queryByTestId('voice-speaking-u1')).toBeNull();
      expect(screen.getByTestId('voice-speaking-u3')).toBeTruthy();
      expect(screen.queryByTestId('voice-speaking-muted-u3')).toBeNull();
    });

    it('shows no ring for someone muted locally who is not speaking, or whose microphone is off', async () => {
      const micOff = [{ userId: 'u1', name: 'Ana', loading: false, muted: true, isSelf: false }, call[2]];
      await render(
        <VoiceParticipantList participants={micOff} speakingIds={new Set(['u1'])} locallyMuted={new Set(['u1', 'u3'])} />,
      );

      expect(screen.queryByTestId(/voice-speaking-/)).toBeNull();
    });

    it('shows no button and no indicator without the new props, like the roster', async () => {
      await render(<VoiceParticipantList participants={call} variant="roomy" />);

      expect(screen.queryByTestId(/voice-local-mute-/)).toBeNull();
      expect(screen.queryByLabelText(VOICE_TEXTS.locallyMuted)).toBeNull();
    });
  });

  it('shows the neutral placeholder while the name loads, never the id', async () => {
    await render(<VoiceParticipantList participants={participants} />);

    expect(screen.queryByText('u3')).toBeNull();
    expect(screen.getByText('Cargando…')).toBeTruthy();
  });
});
