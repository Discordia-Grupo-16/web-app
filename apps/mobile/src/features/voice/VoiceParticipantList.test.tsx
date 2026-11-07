import { render, screen } from '@testing-library/react-native';
import type { ChannelParticipantView } from '@discordia/core';
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

  it('is labelled for the channel, not only for the call: it also lists who is in a channel I am not in', async () => {
    await render(<VoiceParticipantList participants={participants} />);

    expect(screen.getByLabelText('Participantes del canal')).toBeTruthy();
    expect(screen.queryByLabelText('Participantes de la llamada')).toBeNull();
  });

  it('marks only the muted participants', async () => {
    await render(<VoiceParticipantList participants={participants} variant="roomy" />);

    expect(screen.getAllByLabelText('Silenciado')).toHaveLength(1);
  });

  it('shows the neutral placeholder while the name loads, never the id', async () => {
    await render(<VoiceParticipantList participants={participants} />);

    expect(screen.queryByText('u3')).toBeNull();
    expect(screen.getByText('Cargando…')).toBeTruthy();
  });
});
