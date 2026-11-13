import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Channel, Server } from '@discordia/api';
import { NONE, VIEW_CHANNEL, useServerVoiceRoster, useVoice, type VoiceContextValue } from '@discordia/core';
import { voiceService } from '@/shared/api';
import { useCurrentServer } from '@/features/servers';
import { ServerPanel } from './ServerPanel';

vi.mock('@/shared/api', () => ({
    channelsService: {},
    ownershipSource: {},
    voiceService: { getServerVoiceParticipants: vi.fn() },
}));
vi.mock('@/features/invitations', () => ({ InviteButton: () => null }));
vi.mock('@/features/roles', () => ({
    RolesSection: () => null,
    useRoles: () => ({ roles: [], loading: false, addRole: vi.fn(), updateRole: vi.fn() }),
}));
vi.mock('@/features/members', () => ({
    MembersSection: () => null,
    BansSection: () => null,
    useMembers: () => ({ members: [], loading: false, setMemberRoles: vi.fn(), removeMember: vi.fn() }),
    useBans: () => ({ bans: [], loading: false, error: false, removeBan: vi.fn(), reload: vi.fn() }),
}));
vi.mock('@/features/servers', () => ({
    LeaveServerButton: () => null,
    ServerHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
    useCurrentServer: vi.fn(),
}));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Milton' } }),
    useVoice: vi.fn(),
    // The ownership transfer of the panel has its own tests (ServerPanel.test.tsx).
    useOutgoingOwnershipTransfer: () => ({ view: { kind: 'none' }, busy: null, error: null, reload: vi.fn() }),
    useVoiceCallParticipants: (participants: { userId: string }[]) =>
        participants.map(p => ({ userId: p.userId, name: `Nombre ${p.userId}`, loading: false, muted: false })),
    // The roster and its names have their own tests in core; here only what the panel does with them.
    useServerVoiceRoster: vi.fn(),
    useVoiceRosterViews: (roster: Map<string, { userId: string }[]>) =>
        new Map([...roster].map(([channelId, people]) => [
            channelId,
            people.map(p => ({ userId: p.userId, name: `Roster ${p.userId}`, loading: false })),
        ])),
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
        micPending: false,
        reconnecting: false,
        participants: [{ userId: 'ana', isLocal: false, muted: false, joinedAt: 1, seenOrder: 0 }],
    },
});

const joinedAt = '2026-11-05T10:00:00Z';

// Who `chat` says is in each channel, as the roster hook would return it.
const rosterOf = (channels: Record<string, string[]>) =>
    new Map(Object.entries(channels).map(([channelId, ids]) => [channelId, ids.map(userId => ({ userId, joinedAt }))]));

const renderPanel = (
    serverId: string,
    voice: Partial<VoiceContextValue>,
    roster: Record<string, string[]> = {},
    server: Server = servers[serverId],
) => {
    vi.mocked(useServerVoiceRoster).mockReturnValue(rosterOf(roster));
    vi.mocked(useVoice).mockReturnValue({ call: { status: 'idle' }, ...voice } as VoiceContextValue);
    vi.mocked(useCurrentServer).mockReturnValue({
        server,
        loading: false,
        updateChannels: vi.fn(),
    } as unknown as ReturnType<typeof useCurrentServer>);
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

        expect(screen.queryByRole('list', { name: 'Participantes del canal' })).not.toBeInTheDocument();
    });

    describe('roster of the channels I am not in', () => {
        it('lists who is connected under that channel, and nothing under an empty one', () => {
            renderPanel('s1', {}, { v1: ['ana', 'beto'] });

            expect(within(rowOf('lobby')).getByText('Roster ana')).toBeInTheDocument();
            expect(within(rowOf('lobby')).getByText('Roster beto')).toBeInTheDocument();
            expect(within(rowOf('juegos')).queryByRole('list')).not.toBeInTheDocument();
            expect(screen.getAllByRole('list')).toHaveLength(1);
        });

        it('lists each channel with people under its own name', () => {
            renderPanel('s1', {}, { v1: ['ana'], v2: ['beto'] });

            expect(within(rowOf('lobby')).getByText('Roster ana')).toBeInTheDocument();
            expect(within(rowOf('juegos')).getByText('Roster beto')).toBeInTheDocument();
            expect(within(rowOf('lobby')).queryByText('Roster beto')).not.toBeInTheDocument();
        });

        it('shows the list of the call in my channel and the roster in the others (W14)', () => {
            // The roster also has me in v1, a moment late: it must not be drawn there.
            renderPanel('s1', inCallAt('v1', 's1'), { v1: ['ana', 'me'], v2: ['beto'] });

            expect(within(rowOf('lobby')).getByText('Nombre ana')).toBeInTheDocument();
            expect(screen.queryByText('Roster ana')).not.toBeInTheDocument();
            expect(screen.queryByText('Roster me')).not.toBeInTheDocument();
            expect(within(rowOf('juegos')).getByText('Roster beto')).toBeInTheDocument();
        });

        it('shows the roster in a channel of this server while I am in a call in another one', () => {
            renderPanel('s2', inCallAt('v1', 's1'), { v3: ['ana'] });

            expect(within(rowOf('charla')).getByText('Roster ana')).toBeInTheDocument();
        });

        it('asks for the roster of the open server, and of none without VIEW_CHANNEL', () => {
            renderPanel('s1', {});
            expect(useServerVoiceRoster).toHaveBeenLastCalledWith('s1', voiceService.getServerVoiceParticipants);

            renderPanel('s1', {}, {}, { ...servers.s1, my_permissions: NONE });
            expect(useServerVoiceRoster).toHaveBeenLastCalledWith(undefined, voiceService.getServerVoiceParticipants);
        });
    });
});
