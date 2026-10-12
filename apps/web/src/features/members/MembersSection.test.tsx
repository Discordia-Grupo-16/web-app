import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { ProfileViewerContext } from '@/shared/profile/ProfileViewerContext';
import { MembersSection } from './MembersSection';

vi.mock('@/shared/api', () => ({
    rolesService: { assignRole: vi.fn(), removeRole: vi.fn() },
}));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Felipe', avatarUrl: null } }),
}));

const role = (id: string, name: string, position: number): Role => ({
    id,
    server_id: 'srv',
    name,
    is_default: false,
    permissions: 0,
    permission_names: [],
    position,
    created_at: '2026-10-01T00:00:00Z',
});

const MODERADOR = role('r1', 'Moderador', 1);
const ADMIN = role('r2', 'Admin', 5);

const member = (userId: string, roles: Role[] = []): ServerMember => ({
    user_id: userId,
    joined_at: '2026-10-01T00:00:00Z',
    roles,
});

const profiles: PublicProfiles = new Map([
    ['milton', { id: 'milton', name: 'Milton', avatarUrl: null, bio: null }],
    ['owner', { id: 'owner', name: 'Bruno', avatarUrl: null, bio: null }],
]);

interface Options {
    members?: ServerMember[];
    roles?: Role[];
    canManage?: boolean;
}

const renderSection = ({
    members = [member('milton')],
    roles = [MODERADOR, ADMIN],
    canManage = true,
}: Options = {}) => {
    const onRolesChange = vi.fn();
    const openProfile = vi.fn();
    const source: PublicProfileSource = {
        getPublicProfiles: async () => profiles,
        peekPublicProfile: () => undefined,
    };
    render(
        <PublicProfilesProvider source={source}>
            <ProfileViewerContext.Provider value={{ openProfile }}>
                <MembersSection
                    serverId="srv"
                    members={members}
                    roles={roles}
                    ownerId="owner"
                    canManage={canManage}
                    onRolesChange={onRolesChange}
                />
            </ProfileViewerContext.Provider>
        </PublicProfilesProvider>,
    );
    return { onRolesChange, openProfile, user: userEvent.setup() };
};

describe('MembersSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows the name of each member instead of their id', async () => {
        renderSection();

        expect(await screen.findByText('Milton')).toBeInTheDocument();
    });

    it('counts the members', () => {
        renderSection({ members: [member('milton'), member('owner')] });

        expect(screen.getByText('Miembros — 2')).toBeInTheDocument();
    });

    it('names the member by their highest role', async () => {
        // The list arrives ordered by position, so the last one is the highest: it is the
        // one the backend's hierarchy uses to decide who can act on whom.
        renderSection({ members: [member('milton', [MODERADOR, ADMIN])] });

        expect(await screen.findByText('Admin')).toBeInTheDocument();
        expect(screen.queryByText('Moderador')).not.toBeInTheDocument();
    });

    it('hides the edit button from whoever cannot manage roles', async () => {
        renderSection({ canManage: false });
        await screen.findByText('Milton');

        expect(screen.queryByTitle('Editar roles de Milton')).not.toBeInTheDocument();
    });

    it('does not offer to edit the roles of the owner', async () => {
        // Nobody is above the owner, so the backend refuses it: offering the button would
        // only produce a 403.
        renderSection({ members: [member('owner')] });

        expect(await screen.findByText('Bruno')).toBeInTheDocument();
        expect(screen.queryByTitle('Editar roles de Bruno')).not.toBeInTheDocument();
    });

    it('gives a role and reports the new list', async () => {
        vi.mocked(rolesService.assignRole).mockResolvedValue();
        const { user, onRolesChange } = renderSection();
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Editar roles de Milton'));
        await user.click(screen.getByRole('checkbox', { name: 'Moderador' }));

        expect(rolesService.assignRole).toHaveBeenCalledWith('srv', 'r1', 'milton');
        expect(onRolesChange).toHaveBeenCalledWith('milton', [MODERADOR]);
    });

    it('takes a role away and keeps the rest', async () => {
        // The effective permission is the OR of every role: removing one must not touch
        // what the others grant.
        vi.mocked(rolesService.removeRole).mockResolvedValue();
        const { user, onRolesChange } = renderSection({
            members: [member('milton', [MODERADOR, ADMIN])],
        });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Editar roles de Milton'));
        await user.click(screen.getByRole('checkbox', { name: 'Moderador' }));

        expect(rolesService.removeRole).toHaveBeenCalledWith('srv', 'r1', 'milton');
        expect(onRolesChange).toHaveBeenCalledWith('milton', [ADMIN]);
    });

    it('shows the reason when the backend refuses and changes nothing', async () => {
        vi.mocked(rolesService.assignRole).mockRejectedValue({
            response: { data: { detail: 'No podés gestionar un rol que está en tu misma posición o por encima' } },
        });
        const { user, onRolesChange } = renderSection();
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Editar roles de Milton'));
        await user.click(screen.getByRole('checkbox', { name: 'Admin' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/por encima/);
        expect(onRolesChange).not.toHaveBeenCalled();
    });

    it('says what to do when the server has no roles yet', async () => {
        const { user } = renderSection({ roles: [] });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Editar roles de Milton'));

        expect(screen.getByText(/todavía no tiene roles/)).toBeInTheDocument();
    });

    it('opens the public profile of the member that was clicked', async () => {
        const { user, openProfile } = renderSection();

        await user.click(await screen.findByText('Milton'));

        expect(openProfile).toHaveBeenCalledWith('milton');
    });
});
