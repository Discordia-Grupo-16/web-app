import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECT, PERMISSION_COPY, SEND_MESSAGES, UnreadContext, VIEW_CHANNEL } from '@discordia/core';
import type { Channel, Server } from '@discordia/api';
import { CurrentServerProvider } from '@/features/servers';
import { serversService } from '@/shared/api';
import { ChannelRoute } from './ChannelRoute';

vi.mock('@/shared/api', () => ({ serversService: { getServer: vi.fn() } }));
// El chat real abre un socket: no es lo que este test mira.
vi.mock('@/features/chat', () => ({
    ChatPanel: ({ channelName, canSendMessages }: { channelName: string; canSendMessages: boolean }) => (
        <>
            <p>chat de {channelName}</p>
            <div>{canSendMessages ? 'puede escribir' : PERMISSION_COPY.cannotSendMessage(channelName)}</div>
        </>
    ),
}));
vi.mock('@/features/voice', () => ({
    VoiceChannelPanel: ({ channel, canJoin }: { channel: { id: string; serverId: string; name: string }; canJoin: boolean }) => (
        <>
            <p>voz de {channel.name} en {channel.serverId}</p>
            {canJoin ? <button>Unirse</button> : <p>sin permiso para unirse</p>}
        </>
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

const server = (myPermissions = VIEW_CHANNEL | SEND_MESSAGES | CONNECT): Server => ({
    id: 'srv',
    name: 'Discordia',
    description: null,
    owner_id: 'owner',
    avatar_url: null,
    created_at: '2026-10-01T00:00:00Z',
    my_permissions: myPermissions,
    my_permission_names: [],
    channels: [channel('c1', 'general', 'text'), channel('c2', 'lobby', 'voice')],
});

const setActiveChannel = vi.fn();

const renderAt = (channelId: string) =>
    render(
        <UnreadContext.Provider value={{ state: { byChannel: {} }, setActiveChannel, markAllRead: vi.fn() }}>
            <MemoryRouter initialEntries={[`/servers/srv/channels/${channelId}`]}>
                <Routes>
                    <Route
                        path="/servers/:serverId/channels/:channelId"
                        element={<CurrentServerProvider><ChannelRoute /></CurrentServerProvider>}
                    />
                </Routes>
            </MemoryRouter>
        </UnreadContext.Provider>,
    );

const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
};

describe('ChannelRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(serversService.getServer).mockResolvedValue(server());
    });

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

describe('ChannelRoute y SEND_MESSAGES', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('con el permiso, el compositor se puede usar', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | SEND_MESSAGES));

        renderAt('c1');

        expect(await screen.findByText('puede escribir')).toBeInTheDocument();
    });

    it('sin el permiso, dice por qué', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL));

        renderAt('c1');

        expect(
            await screen.findByText(PERMISSION_COPY.cannotSendMessage('general')),
        ).toBeInTheDocument();
    });

    it('refresca el permiso sin cambiar de canal ni recargar', async () => {
        // Es lo que SCRUM-61 tiene que mostrar en la demo: cambiarle el rol a
        // alguien y ver el efecto. Y es el punto 2 del DoD: el mobile ya lo
        // hacía, así que sin esto las dos plataformas no hacen lo mismo.
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | SEND_MESSAGES));
        renderAt('c1');
        await screen.findByText('puede escribir');

        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL));
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() =>
            expect(
                screen.getByText(PERMISSION_COPY.cannotSendMessage('general')),
            ).toBeInTheDocument(),
        );
    });
});

describe('ChannelRoute y CONNECT (CA2 de SCRUM-51, Unirse a canal de voz de servidor)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sin CONNECT no ofrece unirse', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | SEND_MESSAGES));

        renderAt('c2');

        expect(await screen.findByText('sin permiso para unirse')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Unirse' })).not.toBeInTheDocument();
    });

    it('con VIEW_CHANNEL y CONNECT ofrece unirse', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | CONNECT));

        renderAt('c2');

        expect(await screen.findByRole('button', { name: 'Unirse' })).toBeInTheDocument();
    });

    it('deja de ofrecer unirse cuando el poll trae el servidor sin CONNECT', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | CONNECT));
        renderAt('c2');
        await screen.findByRole('button', { name: 'Unirse' });

        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL));
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() => expect(screen.getByText('sin permiso para unirse')).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: 'Unirse' })).not.toBeInTheDocument();
    });

    describe('reading the channel', () => {
        afterEach(() => setVisibility('visible'));

        it('reports a text channel as open and visible while the user looks at it', async () => {
            renderAt('c1');
            await screen.findByText('chat de general');

            expect(setActiveChannel).toHaveBeenLastCalledWith('c1', true);
        });

        it('does not report it as visible while the tab is in the background', async () => {
            setVisibility('hidden');
            renderAt('c1');
            await screen.findByText('chat de general');

            expect(setActiveChannel).toHaveBeenLastCalledWith('c1', false);
        });

        it('a voice channel is never read: it has no messages', async () => {
            renderAt('c2');
            await screen.findByText('voz de lobby en srv');

            expect(setActiveChannel).not.toHaveBeenCalledWith('c2', true);
        });
    });
});
