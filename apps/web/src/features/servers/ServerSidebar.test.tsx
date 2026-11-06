import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@discordia/api';
import { UnreadContext, type ChannelUnreadEntry, type UnreadState } from '@discordia/core';
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

const renderSidebar = async (state: UnreadState, at = '/servers/s1') => {
    render(
        <UnreadContext.Provider value={{ state, setActiveChannel: vi.fn(), markAllRead }}>
            <MemoryRouter initialEntries={[at]}>
                <Routes>
                    <Route path="/servers/:serverId" element={<ServerSidebar />} />
                    <Route path="/" element={<ServerSidebar />} />
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
});
