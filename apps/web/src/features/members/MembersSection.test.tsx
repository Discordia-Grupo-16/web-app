import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { membersService, rolesService } from '@/shared/api';
import { ProfileViewerContext } from '@/shared/profile/ProfileViewerContext';
import { MembersSection } from './MembersSection';

vi.mock('@/shared/api', () => ({
    rolesService: { assignRole: vi.fn(), removeRole: vi.fn() },
    membersService: { banMember: vi.fn(), kickMember: vi.fn() },
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
    canKick?: boolean;
    canBan?: boolean;
}

const renderSection = ({
    members = [member('milton')],
    roles = [MODERADOR, ADMIN],
    canManage = true,
    canKick = false,
    canBan = false,
}: Options = {}) => {
    const onRolesChange = vi.fn();
    const onMemberKicked = vi.fn();
    const onMemberBanned = vi.fn();
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
                    canKick={canKick}
                    canBan={canBan}
                    onRolesChange={onRolesChange}
                    onMemberKicked={onMemberKicked}
                    onMemberBanned={onMemberBanned}
                />
            </ProfileViewerContext.Provider>
        </PublicProfilesProvider>,
    );
    return { onRolesChange, onMemberKicked, onMemberBanned, openProfile, user: userEvent.setup() };
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

    it('offers no kick to whoever lacks KICK_MEMBERS', async () => {
        renderSection({ canKick: false });
        await screen.findByText('Milton');

        expect(screen.queryByTitle('Expulsar a Milton')).not.toBeInTheDocument();
    });

    it('never offers to kick the owner, who the backend refuses', async () => {
        // Rendering it would mean a button whose only possible outcome is a 403.
        renderSection({ members: [member('owner')], canKick: true });
        await screen.findByText('Bruno');

        expect(screen.queryByTitle('Expulsar a Bruno')).not.toBeInTheDocument();
    });

    it('never offers to kick oneself', async () => {
        renderSection({ members: [member('me')], canKick: true });

        expect(screen.queryByTitle(/Expulsar a/)).not.toBeInTheDocument();
    });

    it('warns that the kicked member can come back with an invitation', async () => {
        // It is what sets a kick apart from a ban, and the half a moderator may get wrong.
        const { user } = renderSection({ canKick: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Expulsar a Milton'));

        expect(screen.getByText(/Puede volver a entrar con una nueva invitación/)).toBeInTheDocument();
    });

    it('kicks and takes the member off the list', async () => {
        vi.mocked(membersService.kickMember).mockResolvedValue(undefined);
        const { user, onMemberKicked } = renderSection({ canKick: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Expulsar a Milton'));
        await user.click(screen.getByRole('button', { name: 'Expulsar' }));

        expect(membersService.kickMember).toHaveBeenCalledWith('srv', 'milton');
        expect(onMemberKicked).toHaveBeenCalledWith('milton');
    });

    it('shows why the backend refused a kick and keeps the member on the list', async () => {
        // The hierarchy lives in `community`: this screen does not know the roles of the
        // caller, so the only honest thing it can do is repeat the refusal.
        vi.mocked(membersService.kickMember).mockRejectedValue({
            response: {
                data: {
                    detail: 'No podés moderar a un miembro con jerarquía igual o superior a la tuya',
                },
            },
        });
        const { user, onMemberKicked } = renderSection({ canKick: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Expulsar a Milton'));
        await user.click(screen.getByRole('button', { name: 'Expulsar' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/jerarquía igual o superior/);
        expect(onMemberKicked).not.toHaveBeenCalled();
    });

    it('does not kick when the dialog is dismissed', async () => {
        const { user, onMemberKicked } = renderSection({ canKick: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Expulsar a Milton'));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(membersService.kickMember).not.toHaveBeenCalled();
        expect(onMemberKicked).not.toHaveBeenCalled();
    });

    it('offers no ban to whoever lacks BAN_MEMBERS', async () => {
        renderSection({ canBan: false });
        await screen.findByText('Milton');

        expect(screen.queryByTitle('Banear a Milton')).not.toBeInTheDocument();
    });

    it('never offers to ban the owner, who the backend refuses', async () => {
        // Rendering it would mean a button whose only possible outcome is a 403.
        renderSection({ members: [member('owner')], canBan: true });
        await screen.findByText('Bruno');

        expect(screen.queryByTitle('Banear a Bruno')).not.toBeInTheDocument();
    });

    it('never offers to ban oneself', async () => {
        renderSection({ members: [member('me')], canBan: true });

        expect(screen.queryByTitle(/Banear a/)).not.toBeInTheDocument();
    });

    it('warns that an invitation will not bring the banned member back', async () => {
        // It is the half of the ban a moderator cannot guess from the word.
        const { user } = renderSection({ canBan: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Banear a Milton'));

        expect(screen.getByText(/no va a poder volver a entrar con ninguna invitación/)).toBeInTheDocument();
    });

    it('bans with the reason and takes the member off the list', async () => {
        vi.mocked(membersService.banMember).mockResolvedValue(undefined);
        const { user, onMemberBanned } = renderSection({ canBan: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Banear a Milton'));
        await user.type(screen.getByLabelText('Motivo (opcional)'), 'spam');
        await user.click(screen.getByRole('button', { name: 'Banear' }));

        expect(membersService.banMember).toHaveBeenCalledWith('srv', 'milton', 'spam');
        expect(onMemberBanned).toHaveBeenCalledWith('milton');
    });

    it('bans without a reason, which is optional', async () => {
        vi.mocked(membersService.banMember).mockResolvedValue(undefined);
        const { user, onMemberBanned } = renderSection({ canBan: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Banear a Milton'));
        await user.click(screen.getByRole('button', { name: 'Banear' }));

        expect(membersService.banMember).toHaveBeenCalledWith('srv', 'milton', '');
        expect(onMemberBanned).toHaveBeenCalledWith('milton');
    });

    it('shows why the backend refused and keeps the member on the list', async () => {
        // The hierarchy lives in `community`: this screen does not know the roles of the
        // caller, so the only honest thing it can do is repeat the refusal.
        vi.mocked(membersService.banMember).mockRejectedValue({
            response: {
                data: {
                    detail: 'No podés moderar a un miembro con jerarquía igual o superior a la tuya',
                },
            },
        });
        const { user, onMemberBanned } = renderSection({ canBan: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Banear a Milton'));
        await user.click(screen.getByRole('button', { name: 'Banear' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(/jerarquía igual o superior/);
        expect(onMemberBanned).not.toHaveBeenCalled();
    });

    it('does not ban when the dialog is dismissed', async () => {
        const { user, onMemberBanned } = renderSection({ canBan: true });
        await screen.findByText('Milton');

        await user.click(screen.getByTitle('Banear a Milton'));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(membersService.banMember).not.toHaveBeenCalled();
        expect(onMemberBanned).not.toHaveBeenCalled();
    });

    it('opens the public profile of the member that was clicked', async () => {
        const { user, openProfile } = renderSection();

        await user.click(await screen.findByText('Milton'));

        expect(openProfile).toHaveBeenCalledWith('milton');
    });
});
