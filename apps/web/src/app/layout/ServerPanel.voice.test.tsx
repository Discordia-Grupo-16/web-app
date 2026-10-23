import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel, Server } from '@discordia/api';
import { VIEW_CHANNEL, useVoice, type VoiceContextValue } from '@discordia/core';
import { useServer } from '@/features/servers';
import { ServerPanel } from './ServerPanel';

vi.mock('@/shared/api', () => ({ channelsService: {} }));
vi.mock('@/features/invitations', () => ({ InviteButton: () => null }));
vi.mock('@/features/roles', () => ({
    RolesSection: () => null,
    useRoles: () => ({ roles: [], loading: false, addRole: vi.fn(), updateRole: vi.fn() }),
}));
vi.mock('@/features/members', () => ({
    MembersSection: () => null,
    useMembers: () => ({ members: [], loading: false, setMemberRoles: vi.fn(), removeMember: vi.fn() }),
}));
vi.mock('@/features/servers', () => ({
    LeaveServerButton: () => null,
    ServerHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
    useServer: vi.fn(),
}));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Milton' } }),
    useVoice: vi.fn(),
    useVoiceCallParticipants: (participants: { userId: string }[]) =>
        participants.map(p => ({ userId: p.userId, name: `Nombre ${p.userId}`, loading: false, muted: false })),
}));

const channel = (id: string, name: string, serverId: string, type: Channel['type'] = 'voice'): Channel => ({
    id,
    server_id: serverId,
    name,
    type,
    topic: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

const servers: Record<string, Server> = {
    s1: { id: 's1', name: 'Uno', owner_id: 'other', my_permissions: VIEW_CHANNEL, channels: [channel('c1', 'general', 's1', 'text'), channel('v1', 'lobby', 's1'), channel('v2', 'juegos', 's1')] } as Server,
    s2: { id: 's2', name: 'Dos', owner_id: 'other', my_permissions: VIEW_CHANNEL, channels: [channel('v3', 'charla', 's2')] } as Server,
};

const inCallAt = (channelId: string, serverId: string): Partial<VoiceContextValue> => ({
    call: {
        status: 'connected',
        channel: { id: channelId, serverId, name: 'lobby' },
        micAvailable: true,
        micBlocked: false,
        muted: false,
        participants: [{ userId: 'ana', isLocal: false, muted: false, joinedAt: 1, seenOrder: 0 }],
    },
});

const renderPanel = (serverId: string, voice: Partial<VoiceContextValue>) => {
    vi.mocked(useVoice).mockReturnValue({ call: { status: 'idle' }, ...voice } as VoiceContextValue);
    render(
        <MemoryRouter initialEntries={[`/servers/${serverId}`]}>
            <Routes>
                <Route path="/servers/:serverId" element={<ServerPanel />} />
            </Routes>
        </MemoryRouter>,
    );
};

const rowOf = (name: string) => screen.getByRole('button', { name }).closest('div')!.parentElement!;

describe('ServerPanel', () => {
    beforeEach(() => {
        vi.mocked(useServer).mockImplementation(id => ({
            server: servers[id!],
            loading: false,
            updateChannels: vi.fn(),
        }) as unknown as ReturnType<typeof useServer>);
    });

    it('lists the call under the connected channel only', () => {
        renderPanel('s1', inCallAt('v1', 's1'));

        expect(within(rowOf('lobby')).getByText('Nombre ana')).toBeInTheDocument();
        expect(within(rowOf('juegos')).queryByText('Nombre ana')).not.toBeInTheDocument();
        expect(screen.getAllByText('Nombre ana')).toHaveLength(1);
    });

    it('does not list the call in another server', () => {
        renderPanel('s2', inCallAt('v1', 's1'));

        expect(screen.getByRole('button', { name: 'charla' })).toBeInTheDocument();
        expect(screen.queryByText('Nombre ana')).not.toBeInTheDocument();
    });

    it('lists nobody without a call', () => {
        renderPanel('s1', {});

        expect(screen.queryByRole('list', { name: 'Participantes de la llamada' })).not.toBeInTheDocument();
    });
});
