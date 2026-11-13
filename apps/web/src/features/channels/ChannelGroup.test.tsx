import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Channel } from '@discordia/api';
import { UnreadContext, type ChannelUnreadEntry, type UnreadState } from '@discordia/core';
import { ChannelGroup } from './ChannelGroup';

const channel = (id: string, name: string): Channel => ({
    id,
    server_id: 'srv',
    name,
    type: 'text',
    topic: null,
    category_id: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

const entry = (overrides: Partial<ChannelUnreadEntry> = {}): ChannelUnreadEntry => ({
    serverId: 'srv',
    lastMessageId: 'm2',
    lastMessageAt: '2026-11-02T12:02:00Z',
    lastReadMessageId: null,
    lastReadAt: null,
    unread: false,
    mentionCount: 0,
    ...overrides,
});

const renderGroup = (state?: UnreadState) => {
    const group = (
        <MemoryRouter>
            <ChannelGroup
                label="Canales de texto"
                channels={[channel('c1', 'general'), channel('c2', 'random')]}
                serverId="srv"
                canManage={false}
                onAdd={vi.fn()}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        </MemoryRouter>
    );
    return render(
        state ? (
            <UnreadContext.Provider value={{ state, setActiveChannel: vi.fn(), markAllRead: vi.fn() }}>
                {group}
            </UnreadContext.Provider>
        ) : (
            group
        ),
    );
};

describe('ChannelGroup unread marks', () => {
    it('shows a dot and bold only on the channel with news', () => {
        renderGroup({ byChannel: { c1: entry({ unread: true }), c2: entry({ unread: false }) } });

        expect(screen.getByText('general')).toHaveAttribute('data-unread', 'true');
        expect(screen.getByText('general')).toHaveClass('font-semibold');
        expect(screen.getByRole('img', { name: 'Mensajes sin leer en el canal general' })).toBeInTheDocument();
        expect(screen.getByText('random')).not.toHaveAttribute('data-unread');
        expect(screen.queryByRole('img', { name: /random/ })).not.toBeInTheDocument();
    });

    it('a mention stands out from plain activity: it shows its count instead of the dot', () => {
        renderGroup({ byChannel: { c1: entry({ unread: true, mentionCount: 2 }) } });

        expect(screen.getByRole('img', { name: '2 menciones sin leer en el canal general' })).toHaveTextContent('2');
        expect(screen.queryByRole('img', { name: 'Mensajes sin leer en el canal general' })).not.toBeInTheDocument();
    });

    it('says "mención" in the singular for one', () => {
        renderGroup({ byChannel: { c1: entry({ unread: true, mentionCount: 1 }) } });

        expect(screen.getByRole('img', { name: '1 mención sin leer en el canal general' })).toBeInTheDocument();
    });

    it('shows nothing without the unread provider', () => {
        renderGroup();

        expect(screen.getByText('general')).toBeInTheDocument();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
});
