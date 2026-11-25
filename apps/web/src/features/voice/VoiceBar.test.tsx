import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { formatMutedUntil, useVoice, VOICE_TEXTS } from '@discordia/core';
import { voiceValue } from './testing';
import { VoiceBar } from './VoiceBar';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useVoice: vi.fn(),
}));

const general = { id: 'c1', serverId: 's1', name: 'General' };
const juegos = { id: 'c2', serverId: 's1', name: 'Juegos' };

const connected = (
    extra: {
        reconnecting?: boolean;
        micAvailable?: boolean;
        muted?: boolean;
        micPending?: boolean;
        serverMuted?: boolean;
        serverMutedUntil?: string | null;
    } = {},
) => ({
    status: 'connected' as const,
    channel: general,
    micAvailable: extra.micAvailable ?? true,
    micBlocked: false,
    muted: extra.muted ?? false,
    micPending: extra.micPending ?? false,
    reconnecting: extra.reconnecting ?? false,
    serverMuted: extra.serverMuted ?? false,
    serverMutedUntil: extra.serverMutedUntil ?? null,
    participants: [],
});

const renderBar = () =>
    render(
        <MemoryRouter>
            <VoiceBar />
        </MemoryRouter>,
    );

describe('VoiceBar', () => {
    it('shows nothing without a call', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue());
        const { container } = renderBar();

        expect(container).toBeEmptyDOMElement();
    });

    it('links to the channel of the call', () => {
        vi.mocked(useVoice).mockReturnValue(
            voiceValue({ call: { status: 'connected', channel: general, micAvailable: true, micBlocked: false, muted: false, micPending: false, reconnecting: false, serverMuted: false, serverMutedUntil: null, participants: [] } }),
        );
        renderBar();

        expect(screen.getByText('Conectado a')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute('href', '/servers/s1/channels/c1');
    });

    it('shows the reason of the exit and closes it', async () => {
        const value = voiceValue({ call: { status: 'disconnected', channel: general, reason: 'other_device' } });
        vi.mocked(useVoice).mockReturnValue(value);
        renderBar();

        expect(screen.getByRole('status')).toHaveTextContent('Te uniste desde otro dispositivo.');
        await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
        expect(value.dismiss).toHaveBeenCalled();
    });

    it('leaves the call (CA1 de SCRUM-52, Salir de canal de voz)', async () => {
        const value = voiceValue({ call: connected() });
        vi.mocked(useVoice).mockReturnValue(value);
        renderBar();

        await userEvent.click(screen.getByRole('button', { name: 'Salir de la llamada' }));

        expect(value.leave).toHaveBeenCalled();
    });

    it('waits for a join in progress before letting the user leave', () => {
        vi.mocked(useVoice).mockReturnValue(
            voiceValue({ call: connected(), attempt: { status: 'connecting', channel: juegos } }),
        );
        renderBar();

        expect(screen.getByRole('button', { name: 'Salir de la llamada' })).toBeDisabled();
    });

    it('shows that the call is reconnecting', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connected({ reconnecting: true }) }));
        renderBar();

        expect(screen.getByText('Reconectando…')).toBeInTheDocument();
        expect(screen.queryByText('Conectado a')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Salir de la llamada' })).toBeEnabled();
    });

    it.each(['connection_lost', 'app_backgrounded'] as const)('offers to rejoin after %s', async (reason) => {
        const value = voiceValue({ call: { status: 'disconnected', channel: general, reason } });
        vi.mocked(useVoice).mockReturnValue(value);
        renderBar();

        await userEvent.click(screen.getByRole('button', { name: 'Volver a unirse' }));

        expect(value.rejoin).toHaveBeenCalled();
        expect(value.join).not.toHaveBeenCalled();
    });

    it.each(['other_device', 'kicked'] as const)('does not offer to rejoin after %s', (reason) => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: { status: 'disconnected', channel: general, reason } }));
        renderBar();

        expect(screen.queryByRole('button', { name: 'Volver a unirse' })).not.toBeInTheDocument();
    });

    it.each([
        ['active', {}, 'Silenciar micrófono', 'false'],
        ['muted', { muted: true }, 'Activar micrófono', 'true'],
        ['without microphone', { micAvailable: false, muted: true }, 'Activar micrófono', 'true'],
    ] as const)('shows the microphone %s', (_label, state, name, pressed) => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connected(state) }));
        renderBar();

        expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', pressed);
    });

    it('tells that there is no microphone (CA2 de SCRUM-53, Silenciar micrófono propio)', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connected({ micAvailable: false, muted: true }) }));
        renderBar();

        expect(screen.getByRole('button', { name: 'Activar micrófono' })).toHaveAccessibleDescription(
            'Estás conectado sin micrófono: los demás no te escuchan.',
        );
    });

    it('mutes from the bar (CA1 de SCRUM-53, Silenciar micrófono propio)', async () => {
        const value = voiceValue({ call: connected() });
        vi.mocked(useVoice).mockReturnValue(value);
        renderBar();

        await userEvent.click(screen.getByRole('button', { name: 'Silenciar micrófono' }));

        expect(value.toggleMute).toHaveBeenCalled();
    });

    it('waits while the microphone is being turned on', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connected({ muted: true, micPending: true }) }));
        renderBar();

        const button = screen.getByRole('button', { name: 'Activar micrófono' });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('waits for a join in progress before letting the user mute', () => {
        vi.mocked(useVoice).mockReturnValue(
            voiceValue({ call: connected(), attempt: { status: 'connecting', channel: juegos } }),
        );
        renderBar();

        expect(screen.getByRole('button', { name: 'Silenciar micrófono' })).toBeDisabled();
    });

    it('has no microphone button without a call', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue());
        renderBar();

        expect(screen.queryByRole('button', { name: /micrófono/ })).not.toBeInTheDocument();
    });

    describe('with a moderator mute (SCRUM-71)', () => {
        const until = '2099-01-01T15:30:00Z';

        it('blocks the microphone and says why, with the hour', () => {
            vi.mocked(useVoice).mockReturnValue(
                voiceValue({ call: connected({ muted: true, serverMuted: true, serverMutedUntil: until }) }),
            );
            renderBar();

            const button = screen.getByRole('button', { name: 'Activar micrófono' });
            expect(button).toBeDisabled();
            expect(screen.getByText(VOICE_TEXTS.serverMutedUntil(formatMutedUntil(until)))).toBeInTheDocument();
            expect(button).toHaveAccessibleDescription(VOICE_TEXTS.serverMutedUntil(formatMutedUntil(until)));
        });

        it('says it without the hour until chat answers', () => {
            vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connected({ muted: true, serverMuted: true }) }));
            renderBar();

            expect(screen.getByText(VOICE_TEXTS.serverMuted)).toBeInTheDocument();
        });

        it('shows nothing of it, and leaves the microphone alone, without the mute', () => {
            vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connected() }));
            renderBar();

            expect(screen.queryByText(VOICE_TEXTS.serverMuted)).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Silenciar micrófono' })).toBeEnabled();
        });
    });
});
