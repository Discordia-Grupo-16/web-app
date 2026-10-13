import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VOICE_NAME_PLACEHOLDER, type ChannelParticipantView } from '@discordia/core';
import { VoiceParticipantList } from './VoiceParticipantList';

const ANA_ID = '22222222-2222-2222-2222-222222222222';
const LOADING_ID = '33333333-3333-3333-3333-333333333333';

const participants: ChannelParticipantView[] = [
    { userId: ANA_ID, name: 'Ana', loading: false, muted: true },
    { userId: 'me', name: 'Milton', loading: false, muted: false },
    { userId: LOADING_ID, name: VOICE_NAME_PLACEHOLDER, loading: true },
];

describe('VoiceParticipantList', () => {
    it('shows the names and the mute icon only for the muted ones', () => {
        render(<VoiceParticipantList participants={participants} />);

        const items = screen.getAllByRole('listitem');
        expect(items.map(i => i.textContent)).toEqual(['AAna', 'MMilton', VOICE_NAME_PLACEHOLDER]);
        expect(screen.getAllByLabelText('Silenciado')).toHaveLength(1);
        expect(items[0]).toContainElement(screen.getByLabelText('Silenciado'));
    });

    it('never shows an id', () => {
        const { container } = render(<VoiceParticipantList participants={participants} variant="roomy" />);

        expect(container.textContent).not.toContain(ANA_ID.slice(0, 8));
        expect(container.textContent).not.toContain(LOADING_ID.slice(0, 8));
    });
});
