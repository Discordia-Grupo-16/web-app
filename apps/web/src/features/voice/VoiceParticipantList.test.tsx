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

    describe('who is speaking (SCRUM-56, Indicador de quién está hablando)', () => {
        const speakingItems = () => screen.getAllByRole('listitem').filter(i => i.hasAttribute('data-speaking'));

        it('highlights only the row of whoever speaks', () => {
            render(<VoiceParticipantList participants={participants} speakingIds={new Set([ANA_ID, 'me'])} />);

            // Ana is muted, so only Milton is highlighted even though both are in the set.
            expect(speakingItems().map(i => i.textContent)).toEqual(['MMilton']);
        });

        it('highlights nobody who is muted, even if the set has them', () => {
            render(<VoiceParticipantList participants={participants} speakingIds={new Set([ANA_ID])} />);

            expect(speakingItems()).toHaveLength(0);
        });

        it('highlights several at once', () => {
            const both = [
                { userId: 'a', name: 'Ana', loading: false, muted: false },
                { userId: 'b', name: 'Beto', loading: false, muted: false },
            ];
            render(<VoiceParticipantList participants={both} speakingIds={new Set(['a', 'b'])} />);

            expect(speakingItems()).toHaveLength(2);
        });

        it('draws the ring around the avatar only for whoever speaks', () => {
            render(<VoiceParticipantList participants={participants} speakingIds={new Set(['me'])} />);

            const [ana, me] = screen.getAllByRole('listitem');
            expect((me.firstElementChild as HTMLElement).style.boxShadow).not.toBe('');
            expect((ana.firstElementChild as HTMLElement).style.boxShadow).toBe('');
        });

        it('highlights nobody without speakingIds', () => {
            render(<VoiceParticipantList participants={participants} />);

            expect(speakingItems()).toHaveLength(0);
        });

        it('keeps the order of the rows when who is speaking changes', () => {
            const { rerender } = render(<VoiceParticipantList participants={participants} speakingIds={new Set(['me'])} />);
            const before = screen.getAllByRole('listitem').map(i => i.textContent);

            rerender(<VoiceParticipantList participants={participants} speakingIds={new Set([LOADING_ID])} />);

            expect(screen.getAllByRole('listitem').map(i => i.textContent)).toEqual(before);
            expect(speakingItems().map(i => i.textContent)).toEqual([VOICE_NAME_PLACEHOLDER]);
        });
    });

    it('never shows an id', () => {
        const { container } = render(<VoiceParticipantList participants={participants} variant="roomy" />);

        expect(container.textContent).not.toContain(ANA_ID.slice(0, 8));
        expect(container.textContent).not.toContain(LOADING_ID.slice(0, 8));
    });
});
