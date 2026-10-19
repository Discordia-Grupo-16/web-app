import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useVoice } from '@discordia/core';
import { voiceValue } from './testing';
import { VoiceBar } from './VoiceBar';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useVoice: vi.fn(),
}));

const general = { id: 'c1', serverId: 's1', name: 'General' };
const juegos = { id: 'c2', serverId: 's1', name: 'Juegos' };

const connected = (extra: { reconnecting?: boolean } = {}) => ({
    status: 'connected' as const,
    channel: general,
    micAvailable: true,
    micBlocked: false,
    muted: false,
    reconnecting: extra.reconnecting ?? false,
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
            voiceValue({ call: { status: 'connected', channel: general, micAvailable: true, micBlocked: false, muted: false, reconnecting: false, participants: [] } }),
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

        expect(value.join).toHaveBeenCalledWith(general);
    });

    it.each(['other_device', 'kicked'] as const)('does not offer to rejoin after %s', (reason) => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: { status: 'disconnected', channel: general, reason } }));
        renderBar();

        expect(screen.queryByRole('button', { name: 'Volver a unirse' })).not.toBeInTheDocument();
    });
});
