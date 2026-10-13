import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Channel, Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { ChannelRoute } from './ChannelRoute';

vi.mock('@/shared/api', () => ({ serversService: { getServer: vi.fn() } }));
vi.mock('@/features/chat', () => ({ ChatPanel: ({ channelName }: { channelName: string }) => <p>chat de {channelName}</p> }));
vi.mock('@/features/voice', () => ({
    VoiceChannelPanel: ({ channel }: { channel: { id: string; serverId: string; name: string } }) => (
        <p>voz de {channel.name} en {channel.serverId}</p>
    ),
}));

const channel = (id: string, name: string, type: Channel['type']): Channel => ({
    id,
    server_id: 'srv',
    name,
    type,
    topic: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

const server = { id: 'srv', channels: [channel('c1', 'general', 'text'), channel('c2', 'lobby', 'voice')] } as Server;

const renderAt = (channelId: string) => {
    vi.mocked(serversService.getServer).mockResolvedValue(server);
    render(
        <MemoryRouter initialEntries={[`/servers/srv/channels/${channelId}`]}>
            <Routes>
                <Route path="/servers/:serverId/channels/:channelId" element={<ChannelRoute />} />
            </Routes>
        </MemoryRouter>,
    );
};

describe('ChannelRoute', () => {
    it('shows the voice panel for a voice channel', async () => {
        renderAt('c2');

        expect(await screen.findByText('voz de lobby en srv')).toBeInTheDocument();
        expect(screen.queryByText(/chat de/)).not.toBeInTheDocument();
    });

    it('shows the chat for a text channel', async () => {
        renderAt('c1');

        expect(await screen.findByText('chat de general')).toBeInTheDocument();
        expect(screen.queryByText(/voz de/)).not.toBeInTheDocument();
    });
});
