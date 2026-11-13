import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VOICE_NAME_PLACEHOLDER, VOICE_TEXTS, type ChannelParticipantView } from '@discordia/core';
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

    describe('local mute (SCRUM-57, Silenciar a otro participante localmente)', () => {
        const BOB_ID = '44444444-4444-4444-4444-444444444444';
        const call: ChannelParticipantView[] = [
            { userId: ANA_ID, name: 'Ana', loading: false, muted: false, isSelf: false },
            { userId: 'me', name: 'Milton', loading: false, muted: false, isSelf: true },
            { userId: BOB_ID, name: 'Bob', loading: false, muted: false, isSelf: false },
        ];
        const ring = (item: HTMLElement) => (item.firstElementChild as HTMLElement).style.boxShadow;

        it('offers the button on the rows of the others and not on the own one (CA6)', () => {
            render(<VoiceParticipantList participants={call} variant="roomy" onToggleLocalMute={vi.fn()} />);

            const [ana, me, bob] = screen.getAllByRole('listitem');
            expect(within(ana).getByRole('button', { name: VOICE_TEXTS.localMute })).toBeInTheDocument();
            expect(within(bob).getByRole('button', { name: VOICE_TEXTS.localMute })).toBeInTheDocument();
            expect(within(me).queryByRole('button')).not.toBeInTheDocument();
        });

        it('calls the handler with the userId of the row (CA1)', async () => {
            const onToggleLocalMute = vi.fn();
            render(<VoiceParticipantList participants={call} variant="roomy" onToggleLocalMute={onToggleLocalMute} />);

            await userEvent.click(within(screen.getAllByRole('listitem')[2]).getByRole('button'));

            expect(onToggleLocalMute).toHaveBeenCalledTimes(1);
            expect(onToggleLocalMute).toHaveBeenCalledWith(BOB_ID);
        });

        it('shows the button of whoever is muted as pressed and offering to listen again (CA2)', () => {
            render(
                <VoiceParticipantList
                    participants={call}
                    variant="roomy"
                    locallyMuted={new Set([ANA_ID])}
                    onToggleLocalMute={vi.fn()}
                />,
            );

            const [ana, , bob] = screen.getAllByRole('listitem');
            const anaButton = within(ana).getByRole('button', { name: VOICE_TEXTS.localUnmute });
            expect(anaButton).toHaveAttribute('aria-pressed', 'true');
            expect(within(bob).getByRole('button', { name: VOICE_TEXTS.localMute })).toHaveAttribute('aria-pressed', 'false');
        });

        it('shows only the indicator, with no button, in the compact list', () => {
            render(<VoiceParticipantList participants={call} locallyMuted={new Set([ANA_ID])} onToggleLocalMute={vi.fn()} />);

            const [ana, me] = screen.getAllByRole('listitem');
            expect(within(ana).getByLabelText(VOICE_TEXTS.locallyMuted)).toBeInTheDocument();
            expect(within(me).queryByLabelText(VOICE_TEXTS.locallyMuted)).not.toBeInTheDocument();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('shows both icons for someone with the microphone off and muted locally', () => {
            const muted = [{ userId: ANA_ID, name: 'Ana', loading: false, muted: true, isSelf: false }];
            render(<VoiceParticipantList participants={muted} locallyMuted={new Set([ANA_ID])} />);

            expect(screen.getByLabelText('Silenciado')).toBeInTheDocument();
            expect(screen.getByLabelText(VOICE_TEXTS.locallyMuted)).toBeInTheDocument();
        });

        it('draws a grey ring for whoever speaks while muted locally and a green one otherwise (CA3)', () => {
            render(
                <VoiceParticipantList
                    participants={call}
                    speakingIds={new Set([ANA_ID, BOB_ID])}
                    locallyMuted={new Set([ANA_ID])}
                />,
            );

            const [ana, , bob] = screen.getAllByRole('listitem');
            expect(ana).toHaveAttribute('data-speaking', 'muted');
            expect(bob).toHaveAttribute('data-speaking', 'true');
            expect(ring(ana)).toContain('#72767d');
            expect(ring(bob)).toContain('#3ba55d');
        });

        it('shows no ring for someone muted locally who is not speaking, or whose microphone is off', () => {
            const micOff = [{ userId: ANA_ID, name: 'Ana', loading: false, muted: true, isSelf: false }, call[2]];
            render(
                <VoiceParticipantList
                    participants={micOff}
                    speakingIds={new Set([ANA_ID])}
                    locallyMuted={new Set([ANA_ID, BOB_ID])}
                />,
            );

            const [ana, bob] = screen.getAllByRole('listitem');
            expect(ana).not.toHaveAttribute('data-speaking');
            expect(bob).not.toHaveAttribute('data-speaking');
        });

        it('shows no button and no indicator without the new props, like the roster', () => {
            render(<VoiceParticipantList participants={call} variant="roomy" />);

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
            expect(screen.queryByLabelText(VOICE_TEXTS.locallyMuted)).not.toBeInTheDocument();
        });
    });

    it('never shows an id', () => {
        const { container } = render(<VoiceParticipantList participants={participants} variant="roomy" />);

        expect(container.textContent).not.toContain(ANA_ID.slice(0, 8));
        expect(container.textContent).not.toContain(LOADING_ID.slice(0, 8));
    });
});
