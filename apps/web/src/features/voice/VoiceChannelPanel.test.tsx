import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoice, VOICE_JOIN_ERROR_TEXTS, VOICE_TEXTS, type VoiceChannelRef, type VoiceJoinError } from '@discordia/core';
import { voiceValue } from './testing';
import { VoiceChannelPanel } from './VoiceChannelPanel';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useVoice: vi.fn(),
    useVoiceCallParticipants: vi.fn(() => [{ userId: 'u1', name: 'Ana', loading: false, muted: true }]),
}));

const general: VoiceChannelRef = { id: 'c1', serverId: 's1', name: 'General' };
const other: VoiceChannelRef = { id: 'c2', serverId: 's1', name: 'Juegos' };

const connectedTo = (channel: VoiceChannelRef, extra: { micAvailable?: boolean; micBlocked?: boolean } = {}) => ({
    status: 'connected' as const,
    channel,
    micAvailable: extra.micAvailable ?? true,
    micBlocked: extra.micBlocked ?? false,
    muted: !(extra.micAvailable ?? true),
    micPending: false,
    reconnecting: false,
    participants: [],
});

describe('VoiceChannelPanel', () => {
    beforeEach(() => vi.mocked(useVoice).mockReturnValue(voiceValue()));

    it('offers to join without connecting on open', async () => {
        const value = voiceValue();
        vi.mocked(useVoice).mockReturnValue(value);
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(value.join).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', { name: 'Unirse' }));
        expect(value.join).toHaveBeenCalledWith(general);
    });

    it('shows that it is connecting', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ attempt: { status: 'connecting', channel: general } }));
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(screen.getByRole('button', { name: VOICE_TEXTS.connecting })).toBeDisabled();
    });

    it.each([
        ['forbidden', 'No tenés permiso para unirte a este canal.', false],
        ['not-found', 'Este canal ya no existe.', false],
        ['not-voice', 'Este canal no es de voz.', false],
        ['unavailable', 'La voz no está disponible en este momento.', true],
        ['network', 'No hay conexión.', true],
    ] as const)('shows the %s error, with retry only when it can work', async (error: VoiceJoinError, text, retryable) => {
        const value = voiceValue({ attempt: { status: 'failed', channel: general, error } });
        vi.mocked(useVoice).mockReturnValue(value);
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(screen.getByRole('alert')).toHaveTextContent(text);
        expect(screen.queryByRole('button', { name: 'Unirse' })).not.toBeInTheDocument();
        const retry = screen.queryByRole('button', { name: 'Reintentar' });
        expect(Boolean(retry)).toBe(retryable);
        if (retry) {
            await userEvent.click(retry);
            expect(value.retry).toHaveBeenCalled();
        }
    });

    it('shows the call and its list, never "Unirse", in the connected channel', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(general) }));
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(screen.getByText('Ana')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Unirse' })).not.toBeInTheDocument();
    });

    it('offers to join another channel while in a call', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(other) }));
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(screen.getByRole('button', { name: 'Unirse' })).toBeInTheDocument();
    });

    it('warns about the missing microphone, with instructions when it is blocked', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(general, { micAvailable: false, micBlocked: true }) }));
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(screen.getByRole('status')).toHaveTextContent(VOICE_TEXTS.noMic);
        expect(screen.getByRole('status')).toHaveTextContent(VOICE_TEXTS.micBlockedWeb);
    });

    it('warns without instructions when the microphone was only denied', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(general, { micAvailable: false }) }));
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(screen.getByRole('status')).toHaveTextContent(VOICE_TEXTS.noMic);
        expect(screen.getByRole('status')).not.toHaveTextContent(VOICE_TEXTS.micBlockedWeb);
    });

    it('offers to enable the audio when the browser blocked it', async () => {
        const value = voiceValue({ call: connectedTo(general), audioBlocked: true });
        vi.mocked(useVoice).mockReturnValue(value);
        render(<VoiceChannelPanel channel={general} canJoin />);

        await userEvent.click(screen.getByRole('button', { name: 'Activar audio' }));
        expect(value.startAudio).toHaveBeenCalled();
    });

    it('says voice is not available without an adapter', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ available: false }));
        render(<VoiceChannelPanel channel={general} canJoin />);

        expect(screen.queryByRole('button', { name: 'Unirse' })).not.toBeInTheDocument();
        expect(screen.getByText('La voz no está disponible en este momento.')).toBeInTheDocument();
    });

    it('does not offer to join without the voice permissions (CA2 de SCRUM-51, Unirse a canal de voz de servidor)', () => {
        render(<VoiceChannelPanel channel={general} canJoin={false} />);

        expect(screen.queryByRole('button', { name: 'Unirse' })).not.toBeInTheDocument();
        expect(screen.getByText(VOICE_JOIN_ERROR_TEXTS.forbidden)).toBeInTheDocument();
    });

    it('keeps showing the call of this channel without the voice permissions', () => {
        vi.mocked(useVoice).mockReturnValue(voiceValue({ call: connectedTo(general) }));
        render(<VoiceChannelPanel channel={general} canJoin={false} />);

        expect(screen.getByText('Estás en la llamada')).toBeInTheDocument();
        expect(screen.queryByText(VOICE_JOIN_ERROR_TEXTS.forbidden)).not.toBeInTheDocument();
    });
});
