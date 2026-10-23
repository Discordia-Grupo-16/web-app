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
            voiceValue({ call: { status: 'connected', channel: general, micAvailable: true, micBlocked: false, muted: false, participants: [] } }),
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
});
