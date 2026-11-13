import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVoice, useVoiceSpeakers, type VoiceRoomAdapter } from '@discordia/core';
import { createLivekitAdapter } from './livekitAdapter';
import { VoiceProvider } from './VoiceProvider';

vi.mock('@/shared/api', () => ({
    voiceService: { createVoiceToken: vi.fn(async (id: string) => ({ token: 't', url: 'wss://x', roomName: id, expiresAt: '' })) },
}));

// The listener the controller gives the adapter, so a test can say who is speaking.
let emitSpeakers: (ids: ReadonlySet<string>) => void = () => undefined;

const adapter = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    enableMicrophone: vi.fn(async () => 'ok' as const),
    onDisconnected: () => () => undefined,
    onParticipantsChanged: () => () => undefined,
    onActiveSpeakersChanged: vi.fn((listener: (ids: ReadonlySet<string>) => void) => {
        emitSpeakers = listener;
        return () => undefined;
    }),
    onReconnectingChanged: () => () => undefined,
    muteMicrophone: vi.fn(async () => undefined),
    onMicrophoneLost: () => () => undefined,
} satisfies VoiceRoomAdapter;

vi.mock('./livekitAdapter', () => ({ createLivekitAdapter: vi.fn(() => adapter) }));

const Status = () => {
    const { call, join } = useVoice();
    return (
        <>
            <span>{call.status}</span>
            <button onClick={() => join({ id: 'c1', serverId: 's1', name: 'General' })}>Unirse</button>
        </>
    );
};

const Speakers = () => <span data-testid="speakers">{[...useVoiceSpeakers()].join(',')}</span>;

describe('VoiceProvider', () => {
    it('keeps the call when the tab is hidden', async () => {
        render(
            <VoiceProvider>
                <Status />
            </VoiceProvider>,
        );
        await act(async () => screen.getByRole('button').click());
        expect(await screen.findByText('connected')).toBeInTheDocument();

        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(screen.getByText('connected')).toBeInTheDocument();
        expect(adapter.disconnect).not.toHaveBeenCalled();
        expect(createLivekitAdapter).toHaveBeenCalledTimes(1);
    });

    it('gives the speakers context who is speaking once connected (SCRUM-56)', async () => {
        render(
            <VoiceProvider>
                <Status />
                <Speakers />
            </VoiceProvider>,
        );
        expect(screen.getByTestId('speakers')).toHaveTextContent('');
        await act(async () => screen.getByRole('button').click());
        expect(await screen.findByText('connected')).toBeInTheDocument();

        act(() => emitSpeakers(new Set(['me'])));

        expect(screen.getByTestId('speakers')).toHaveTextContent('me');
    });
});
