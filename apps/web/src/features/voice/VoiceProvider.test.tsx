import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useVoice, type VoiceRoomAdapter } from '@discordia/core';
import { createLivekitAdapter } from './livekitAdapter';
import { VoiceProvider } from './VoiceProvider';

vi.mock('@/shared/api', () => ({
    voiceService: { createVoiceToken: vi.fn(async (id: string) => ({ token: 't', url: 'wss://x', roomName: id, expiresAt: '' })) },
}));

const adapter = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    enableMicrophone: vi.fn(async () => 'ok' as const),
    onDisconnected: () => () => undefined,
    onParticipantsChanged: () => () => undefined,
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
});
