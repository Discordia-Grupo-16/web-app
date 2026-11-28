import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { VOICE_TEXTS, VoiceContext, VoiceSpeakersContext, type ChannelParticipantView } from '@discordia/core';
import { voiceValue } from './testing';
import { gridColumns } from './gridColumns';
import { VoiceCallGrid } from './VoiceCallGrid';

const ANA_ID = '22222222-2222-2222-2222-222222222222';
const BOB_ID = '44444444-4444-4444-4444-444444444444';

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

const participants = [view(ANA_ID, 'Ana'), view('me', 'Milton', { isSelf: true }), view(BOB_ID, 'Bob')];

const highlighted = () =>
    screen.getAllByRole('listitem').filter((i) => i.hasAttribute('data-speaking')).map((i) => i.textContent);

describe('gridColumns (C9)', () => {
    it.each([
        [1, 1],
        [2, 2],
        [4, 2],
        [5, 3],
    ] as const)('gives %i tile(s) %i column(s)', (tiles, columns) => {
        expect(gridColumns(tiles)).toBe(columns);
    });

    it('does not break with nobody, and keeps three columns for a big call', () => {
        expect(gridColumns(0)).toBe(1);
        expect(gridColumns(12)).toBe(3);
    });
});

describe('VoiceCallGrid', () => {
    it('draws one tile per participant, in a list named for the call', () => {
        render(
            <VoiceContext.Provider value={voiceValue()}>
                <VoiceCallGrid participants={participants} />
            </VoiceContext.Provider>,
        );

        const list = screen.getByRole('list', { name: 'Participantes de la llamada' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    });

    it.each([
        [1, 'repeat(1, minmax(0, 1fr))'],
        [3, 'repeat(2, minmax(0, 1fr))'],
        [5, 'repeat(3, minmax(0, 1fr))'],
    ] as const)('lays %i tile(s) out as %s', (count, template) => {
        const many = Array.from({ length: count }, (_, i) => view(`u${i}`, `User ${i}`));
        render(
            <VoiceContext.Provider value={voiceValue()}>
                <VoiceCallGrid participants={many} />
            </VoiceContext.Provider>,
        );

        expect(screen.getByRole('list').style.gridTemplateColumns).toBe(template);
    });

    it('marks who is speaking with the speakers context', () => {
        render(
            <VoiceContext.Provider value={voiceValue()}>
                <VoiceSpeakersContext.Provider value={new Set([ANA_ID])}>
                    <VoiceCallGrid participants={participants} />
                </VoiceSpeakersContext.Provider>
            </VoiceContext.Provider>,
        );

        expect(highlighted()).toEqual(['AAna']);
    });

    it('marks nobody who is muted as speaking, even if the room says so (S8)', () => {
        const muted = [view(ANA_ID, 'Ana', { muted: true })];
        render(
            <VoiceContext.Provider value={voiceValue()}>
                <VoiceSpeakersContext.Provider value={new Set([ANA_ID])}>
                    <VoiceCallGrid participants={muted} />
                </VoiceSpeakersContext.Provider>
            </VoiceContext.Provider>,
        );

        expect(highlighted()).toEqual([]);
    });

    it('marks nobody without a speakers provider', () => {
        render(
            <VoiceContext.Provider value={voiceValue()}>
                <VoiceCallGrid participants={participants} />
            </VoiceContext.Provider>,
        );

        expect(highlighted()).toEqual([]);
    });

    it('shows the grey ring of someone who speaks while muted on this device', () => {
        render(
            <VoiceContext.Provider value={voiceValue({ locallyMuted: new Set([ANA_ID]) })}>
                <VoiceSpeakersContext.Provider value={new Set([ANA_ID])}>
                    <VoiceCallGrid participants={participants} />
                </VoiceSpeakersContext.Provider>
            </VoiceContext.Provider>,
        );

        expect(screen.getAllByRole('listitem')[0]).toHaveAttribute('data-speaking', 'muted');
    });

    it('has the local mute button on the tiles of the others and not on the own, and it works (SCRUM-57)', async () => {
        const value = voiceValue({ locallyMuted: new Set([ANA_ID]) });
        render(
            <VoiceContext.Provider value={value}>
                <VoiceCallGrid participants={participants} />
            </VoiceContext.Provider>,
        );

        const [ana, me, bob] = screen.getAllByRole('listitem');
        expect(within(me).queryByRole('button')).not.toBeInTheDocument();
        expect(within(ana).getByRole('button', { name: VOICE_TEXTS.localUnmute })).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(within(bob).getByRole('button', { name: VOICE_TEXTS.localMute }));

        expect(value.toggleLocalMute).toHaveBeenCalledTimes(1);
        expect(value.toggleLocalMute).toHaveBeenCalledWith(BOB_ID);
    });
});
