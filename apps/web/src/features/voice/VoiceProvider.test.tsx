import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVoice, useVoiceSpeakers, type VoiceParticipant, type VoiceRoomAdapter } from '@discordia/core';
import { createLivekitAdapter } from './livekitAdapter';
import { VoiceProvider } from './VoiceProvider';

vi.mock('@/shared/api', () => ({
    voiceService: { createVoiceToken: vi.fn(async (id: string) => ({ token: 't', url: 'wss://x', roomName: id, expiresAt: '' })) },
}));

// The listener the controller gives the adapter, so a test can say who is speaking.
let emitSpeakers: (ids: ReadonlySet<string>) => void = () => undefined;
// Same for the participants of the call, so a test can put someone in it.
let emitParticipants: (snapshot: VoiceParticipant[]) => void = () => undefined;

const adapter = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    enableMicrophone: vi.fn(async () => 'ok' as const),
    onDisconnected: () => () => undefined,
    onParticipantsChanged: vi.fn((listener: (snapshot: VoiceParticipant[]) => void) => {
        emitParticipants = listener;
        return () => undefined;
    }),
    onActiveSpeakersChanged: vi.fn((listener: (ids: ReadonlySet<string>) => void) => {
        emitSpeakers = listener;
        return () => undefined;
    }),
    onReconnectingChanged: () => () => undefined,
    muteMicrophone: vi.fn(async () => undefined),
    setLocallyMuted: vi.fn<(userIds: ReadonlySet<string>) => void>(),
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

    it('sends the adapter who the user muted locally (SCRUM-57)', async () => {
        const ANA_ID = 'ana';
        const LocalMute = () => {
            const { toggleLocalMute, locallyMuted } = useVoice();
            return (
                <>
                    <span data-testid="muted">{[...locallyMuted].join(',')}</span>
                    <button onClick={() => toggleLocalMute(ANA_ID)}>Silenciar</button>
                </>
            );
        };
        render(
            <VoiceProvider>
                <Status />
                <LocalMute />
            </VoiceProvider>,
        );
        await act(async () => screen.getByRole('button', { name: 'Unirse' }).click());
        expect(await screen.findByText('connected')).toBeInTheDocument();
        act(() => emitParticipants([{ userId: ANA_ID, isLocal: false, muted: false, joinedAt: 1, seenOrder: 0 }]));

        act(() => screen.getByRole('button', { name: 'Silenciar' }).click());

        expect(adapter.setLocallyMuted).toHaveBeenLastCalledWith(new Set([ANA_ID]));
        expect(screen.getByTestId('muted')).toHaveTextContent(ANA_ID);
    });
});
