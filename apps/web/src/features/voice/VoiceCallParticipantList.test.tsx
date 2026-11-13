import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VoiceSpeakersContext, type ChannelParticipantView } from '@discordia/core';
import { VoiceCallParticipantList } from './VoiceCallParticipantList';

const ANA_ID = '22222222-2222-2222-2222-222222222222';

const participants: ChannelParticipantView[] = [
    { userId: ANA_ID, name: 'Ana', loading: false, muted: false },
    { userId: 'me', name: 'Milton', loading: false, muted: false },
];

const highlighted = () =>
    screen.getAllByRole('listitem').filter(i => i.hasAttribute('data-speaking')).map(i => i.textContent);

describe('VoiceCallParticipantList', () => {
    it('highlights who the speakers context says is speaking', () => {
        render(
            <VoiceSpeakersContext.Provider value={new Set([ANA_ID])}>
                <VoiceCallParticipantList participants={participants} />
            </VoiceSpeakersContext.Provider>,
        );

        expect(highlighted()).toEqual(['AAna']);
    });

    it('highlights nobody without a provider', () => {
        render(<VoiceCallParticipantList participants={participants} />);

        expect(highlighted()).toEqual([]);
    });
});
