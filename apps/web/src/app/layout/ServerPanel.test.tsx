import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ServerPanel } from './ServerPanel';

let currentUserId = 'owner';

vi.mock('@discordia/core', () => ({ useAuth: () => ({ user: { id: currentUserId } }) }));
vi.mock('@/features/channels', () => ({ ChannelList: () => null }));
vi.mock('@/features/roles', () => ({
    RolesSection: () => null,
    useRoles: () => ({ roles: [], loading: false, addRole: vi.fn() }),
}));
vi.mock('@/features/invitations', () => ({ InviteButton: () => <button>Invitar</button> }));
vi.mock('@/features/servers', () => ({
    LeaveServerButton: () => null,
    ServerHeader: ({ actions }: { actions?: React.ReactNode }) => <header>{actions}</header>,
    useServer: () => ({ server: { id: 'srv', name: 'Discordia', owner_id: 'owner', channels: [] }, loading: false, updateChannels: vi.fn() }),
}));

const renderPanel = (userId: string) => {
    currentUserId = userId;
    render(
        <MemoryRouter initialEntries={['/servers/srv']}>
            <Routes>
                <Route path="/servers/:serverId" element={<ServerPanel />} />
            </Routes>
        </MemoryRouter>,
    );
};

describe('ServerPanel', () => {
    it('shows the invite button to the owner', () => {
        renderPanel('owner');
        expect(screen.getByRole('button', { name: 'Invitar' })).toBeInTheDocument();
    });

    it('hides the invite button from a non-owner', () => {
        renderPanel('member');
        expect(screen.queryByRole('button', { name: 'Invitar' })).not.toBeInTheDocument();
    });
});
