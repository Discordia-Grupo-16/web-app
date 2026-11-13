import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { VOICE_TEXTS, VoiceContext, VoiceSpeakersContext, type ChannelParticipantView } from '@discordia/core';
import { voiceValue } from './testing';
import { VoiceCallParticipantList } from './VoiceCallParticipantList';

const ANA_ID = '22222222-2222-2222-2222-222222222222';
const BOB_ID = '44444444-4444-4444-4444-444444444444';

const participants: ChannelParticipantView[] = [
    { userId: ANA_ID, name: 'Ana', userAvatar: '', loading: false, muted: false, isSelf: false },
    { userId: 'me', name: 'Milton', userAvatar: '', loading: false, muted: false, isSelf: true },
    { userId: BOB_ID, name: 'Bob', userAvatar: '', loading: false, muted: false, isSelf: false },
];

const highlighted = () =>
    screen.getAllByRole('listitem').filter(i => i.hasAttribute('data-speaking')).map(i => i.textContent);

describe('VoiceCallParticipantList', () => {
    it('highlights who the speakers context says is speaking', () => {
        render(
            <VoiceContext.Provider value={voiceValue()}>
                <VoiceSpeakersContext.Provider value={new Set([ANA_ID])}>
                    <VoiceCallParticipantList participants={participants} />
                </VoiceSpeakersContext.Provider>
            </VoiceContext.Provider>,
        );

        expect(highlighted()).toEqual(['AAna']);
    });

    it('highlights nobody without a speakers provider', () => {
        render(
            <VoiceContext.Provider value={voiceValue()}>
                <VoiceCallParticipantList participants={participants} />
            </VoiceContext.Provider>,
        );

        expect(highlighted()).toEqual([]);
    });

    describe('local mute (SCRUM-57, Silenciar a otro participante localmente)', () => {
        it('marks as muted locally whoever the voice context says', () => {
            render(
                <VoiceContext.Provider value={voiceValue({ locallyMuted: new Set([ANA_ID]) })}>
                    <VoiceCallParticipantList participants={participants} variant="roomy" />
                </VoiceContext.Provider>,
            );

            const [ana, , bob] = screen.getAllByRole('listitem');
            expect(within(ana).getByRole('button', { name: VOICE_TEXTS.localUnmute })).toHaveAttribute('aria-pressed', 'true');
            expect(within(bob).getByRole('button', { name: VOICE_TEXTS.localMute })).toHaveAttribute('aria-pressed', 'false');
        });

        it('calls toggleLocalMute of the voice context with the userId of the clicked row', async () => {
            const value = voiceValue();
            render(
                <VoiceContext.Provider value={value}>
                    <VoiceCallParticipantList participants={participants} variant="roomy" />
                </VoiceContext.Provider>,
            );

            await userEvent.click(within(screen.getAllByRole('listitem')[2]).getByRole('button'));

            expect(value.toggleLocalMute).toHaveBeenCalledTimes(1);
            expect(value.toggleLocalMute).toHaveBeenCalledWith(BOB_ID);
        });

        it('shows the grey ring when someone speaks while muted locally', () => {
            render(
                <VoiceContext.Provider value={voiceValue({ locallyMuted: new Set([ANA_ID]) })}>
                    <VoiceSpeakersContext.Provider value={new Set([ANA_ID])}>
                        <VoiceCallParticipantList participants={participants} />
                    </VoiceSpeakersContext.Provider>
                </VoiceContext.Provider>,
            );

            expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('data-speaking', 'muted');
        });
    });
});
