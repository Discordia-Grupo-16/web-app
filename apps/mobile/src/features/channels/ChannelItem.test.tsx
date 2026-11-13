import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { Channel } from '@discordia/api';
import { UnreadContext, type ChannelUnreadEntry, type UnreadState } from '@discordia/core';
import { ChannelItem } from './ChannelItem';

const channel: Channel = {
  id: 'c1',
  server_id: 'srv',
  name: 'general',
  type: 'text',
  topic: null,
  category_id: null,
  position: 0,
  created_at: '2026-10-01T00:00:00Z',
};

const entry = (overrides: Partial<ChannelUnreadEntry> = {}): ChannelUnreadEntry => ({
  serverId: 'srv',
  lastMessageId: 'm2',
  lastMessageAt: '2026-11-02T12:02:00Z',
  lastReadMessageId: null,
  lastReadAt: null,
  unread: true,
  mentionCount: 0,
  ...overrides,
});

const renderItem = async (state: UnreadState | null) => {
  const item = <ChannelItem channel={channel} canManage={false} onDelete={jest.fn()} onEdit={jest.fn()} />;
  const wrap = (children: ReactElement) =>
    state ? (
      <UnreadContext.Provider value={{ state, setActiveChannel: jest.fn(), markAllRead: jest.fn() }}>
        {children}
      </UnreadContext.Provider>
    ) : (
      children
    );
  await render(wrap(item));
};

describe('ChannelItem unread marks (CA1 de SCRUM-75)', () => {
  it('shows the channel bold with a dot when it has unread messages', async () => {
    await renderItem({ byChannel: { c1: entry() } });

    expect(screen.getByLabelText('Mensajes sin leer en el canal general')).toBeTruthy();
    expect(screen.getByText('# general').props.className).toContain('font-bold');
  });

  it('shows nothing when everything is read', async () => {
    await renderItem({ byChannel: { c1: entry({ unread: false }) } });

    expect(screen.queryByLabelText(/sin leer/)).toBeNull();
    expect(screen.getByText('# general').props.className).not.toContain('font-bold');
  });

  it('does not mark a channel the state does not know', async () => {
    await renderItem({ byChannel: {} });

    expect(screen.queryByLabelText(/sin leer/)).toBeNull();
  });

  it('works without the unread provider', async () => {
    await renderItem(null);

    expect(screen.getByText('# general')).toBeTruthy();
    expect(screen.queryByLabelText(/sin leer/)).toBeNull();
  });

  // Mentions do not exist yet (the count is 0), but the style is ready for them (CA3).
  it('uses a red pill with the count instead of the dot when there are mentions', async () => {
    await renderItem({ byChannel: { c1: entry({ mentionCount: 2 }) } });

    expect(screen.getByLabelText('2 menciones sin leer en el canal general')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByLabelText('Mensajes sin leer en el canal general')).toBeNull();
  });
});
