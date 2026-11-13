import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
    category_id: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

const server = (myPermissions = VIEW_CHANNEL | SEND_MESSAGES | CONNECT): Server => ({
    id: 'srv',
    name: 'Discordia',
    description: null,
    owner_id: 'owner',
    avatar_url: null, banner_url: null,
    created_at: '2026-10-01T00:00:00Z',
    my_permissions: myPermissions,
    my_permission_names: [],
    channels: [channel('c1', 'general', 'text'), channel('c2', 'lobby', 'voice')],
    categories: [],
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

    // The channel is reported from an effect that runs right after the render that shows it. Before the
    // server loads it is reported once as ('', false), with no channel yet. findByText resolves as soon as
    // the text is in the DOM, which can be before that effect runs: on a loaded machine the assertion used
    // to see the earlier ('', false) and fail about 1 run in 20. The guard itself never reported a hidden
    // tab as visible. So these tests wait for the call instead of assuming it already happened.
    describe('reading the channel', () => {
        beforeEach(() => {
            // Its own server: without it the group depended on the mock the previous test left behind.
            vi.mocked(serversService.getServer).mockResolvedValue(server());
        });

        afterEach(() => {
            // Unmount first: restoring the visibility with the route still mounted made it report the
            // channel as visible and refetch the server after the test was over.
            cleanup();
            setVisibility('visible');
        });

        it('reports a text channel as open and visible while the user looks at it', async () => {
            renderAt('c1');
            await screen.findByText('chat de general');

            await waitFor(() => expect(setActiveChannel).toHaveBeenLastCalledWith('c1', true));
        });

        it('does not report it as visible while the tab is in the background', async () => {
            setVisibility('hidden');
            renderAt('c1');
            await screen.findByText('chat de general');

            await waitFor(() => expect(setActiveChannel).toHaveBeenLastCalledWith('c1', false));
            // What matters is that it is never reported as visible, at any point: a visible report is
            // what sends markRead and switches the indicator off for messages nobody saw.
            expect(setActiveChannel).not.toHaveBeenCalledWith('c1', true);
        });

        it('a voice channel is never read: it has no messages', async () => {
            renderAt('c2');
            await screen.findByText('voz de lobby en srv');

            expect(setActiveChannel).not.toHaveBeenCalledWith('c2', true);
        });
    });
});
