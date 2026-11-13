import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvalidateFrame, Server } from '@discordia/api';
import { RealtimeContext, UnreadContext, type ChannelUnreadEntry, type RealtimeContextValue, type UnreadState } from '@discordia/core';
import { serversService } from '@/shared/api';
import { ServerSidebar } from './ServerSidebar';

vi.mock('@/shared/api', () => ({ serversService: { getServers: vi.fn() } }));

const server = (id: string, name: string): Server => ({
    id,
    name,
    description: null,
    owner_id: 'owner',
    avatar_url: null,
    created_at: '2026-10-01T00:00:00Z',
    my_permissions: 0,
    my_permission_names: [],
    channels: [],
});

const entry = (serverId: string, overrides: Partial<ChannelUnreadEntry> = {}): ChannelUnreadEntry => ({
    serverId,
    lastMessageId: 'm2',
    lastMessageAt: '2026-11-02T12:02:00Z',
    lastReadMessageId: null,
    lastReadAt: null,
    unread: true,
    mentionCount: 0,
    ...overrides,
});

const markAllRead = vi.fn();

const ServerRoute = () => (
    <>
        <span data-testid="route">server</span>
        <ServerSidebar />
    </>
);
const HomeRoute = () => (
    <>
        <span data-testid="route">home</span>
        <ServerSidebar />
    </>
);

const renderSidebar = async (state: UnreadState, at = '/servers/s1') => {
    render(
        <UnreadContext.Provider value={{ state, setActiveChannel: vi.fn(), markAllRead }}>
            <MemoryRouter initialEntries={[at]}>
                <Routes>
                    <Route path="/servers/:serverId" element={<ServerRoute />} />
                    <Route path="/" element={<HomeRoute />} />
                </Routes>
            </MemoryRouter>
        </UnreadContext.Provider>,
    );
    await screen.findByTitle('Alfa');
};

describe('ServerSidebar unread marks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        markAllRead.mockResolvedValue(undefined);
        vi.mocked(serversService.getServers).mockResolvedValue([server('s1', 'Alfa'), server('s2', 'Beta')]);
    });

    it('marks the server whenever any of its channels is unread', async () => {
        await renderSidebar({ byChannel: { a: entry('s2', { unread: false }), b: entry('s2') } });

        expect(screen.getByRole('img', { name: 'Mensajes sin leer en el servidor Beta' })).toBeInTheDocument();
        expect(screen.queryByRole('img', { name: /servidor Alfa/ })).not.toBeInTheDocument();
    });

    it('does not mark the server that is open: its channel list already says it', async () => {
        await renderSidebar({ byChannel: { a: entry('s1') } });

        expect(screen.queryByRole('img', { name: /servidor Alfa/ })).not.toBeInTheDocument();
    });

    it('shows the mentions of a server over its icon', async () => {
        await renderSidebar({ byChannel: { a: entry('s2', { mentionCount: 3 }) } });

        expect(screen.getByRole('img', { name: '3 menciones sin leer en el servidor Beta' })).toHaveTextContent('3');
    });

    it('the mark all as read button calls markAllRead', async () => {
        await renderSidebar({ byChannel: { a: entry('s2') } });

        await userEvent.click(screen.getByRole('button', { name: 'Marcar todo como leído' }));

        expect(markAllRead).toHaveBeenCalledTimes(1);
    });

    it('the button is disabled when there is nothing unread', async () => {
        await renderSidebar({ byChannel: { a: entry('s2', { unread: false }) } });

        const button = screen.getByRole('button', { name: 'Marcar todo como leído' });
        expect(button).toBeDisabled();
        await userEvent.click(button);
        expect(markAllRead).not.toHaveBeenCalled();
    });

    it('a failed mark all as read does not break the sidebar', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        markAllRead.mockRejectedValue(new Error('down'));
        await renderSidebar({ byChannel: { a: entry('s2') } });

        await userEvent.click(screen.getByRole('button', { name: 'Marcar todo como leído' }));

        await waitFor(() => expect(error).toHaveBeenCalled());
        expect(screen.getByTitle('Beta')).toBeInTheDocument();
        error.mockRestore();
    });

    it('leaves the selected server when it is removed from the server list', async () => {
        const handlers = new Set<(frame: InvalidateFrame) => void>();
        const realtime = {
            status: 'open',
            onInvalidate: (handler: (frame: InvalidateFrame) => void) => {
                handlers.add(handler);
                return () => handlers.delete(handler);
            },
            onReconnect: () => () => {},
        } as unknown as RealtimeContextValue;

        render(
            <RealtimeContext.Provider value={realtime}>
                <UnreadContext.Provider value={{ state: { byChannel: {} }, setActiveChannel: vi.fn(), markAllRead }}>
                    <MemoryRouter initialEntries={['/servers/s1']}>
                        <Routes>
                            <Route path="/servers/:serverId" element={<ServerRoute />} />
                            <Route path="/" element={<HomeRoute />} />
                        </Routes>
                    </MemoryRouter>
                </UnreadContext.Provider>
            </RealtimeContext.Provider>,
        );
        await screen.findByTitle('Alfa');

        vi.mocked(serversService.getServers).mockResolvedValue([server('s2', 'Beta')]);
        vi.useFakeTimers();
        try {
            act(() => handlers.forEach(handler => handler({ type: 'invalidate', resources: ['servers'] })));
            await act(() => vi.advanceTimersByTimeAsync(1400));
        } finally {
            vi.useRealTimers();
        }

        expect(await screen.findByTestId('route')).toHaveTextContent('home');
        expect(screen.queryByTitle('Alfa')).not.toBeInTheDocument();
    });
});
