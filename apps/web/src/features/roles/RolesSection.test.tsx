import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { RolesSection } from './RolesSection';

vi.mock('@/shared/api', () => ({
    rolesService: { createRole: vi.fn(), updateRolePermissions: vi.fn() },
}));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Felipe', avatarUrl: null } }),
}));

const role = (id: string, name: string): Role => ({
    id,
    server_id: 'srv',
    name,
    is_default: false,
    permissions: 0,
    permission_names: [],
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

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
    roles?: Role[];
    members?: ServerMember[];
    canManage?: boolean;
    onRoleCreated?: () => void;
}

const renderSection = ({
    roles = [],
    members = [],
    canManage = true,
    onRoleCreated = vi.fn(),
}: Options = {}) => {
    const source: PublicProfileSource = {
        getPublicProfiles: async () => profiles,
        peekPublicProfile: () => undefined,
    };
    render(
        <PublicProfilesProvider source={source}>
            <RolesSection
                serverId="srv"
                roles={roles}
                members={members}
                ownerId="owner"
                canManage={canManage}
                onRoleCreated={onRoleCreated}
                onRoleUpdated={vi.fn()}
            />
        </PublicProfilesProvider>,
    );
    return { user: userEvent.setup() };
};

const MODERADOR = role('r2', 'Moderador');
const EVERYONE = role('r1', 'everyone');

describe('RolesSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists the roles and hides the create button for members who cannot manage', () => {
        renderSection({ roles: [EVERYONE], canManage: false });

        expect(screen.getByText('everyone')).toBeInTheDocument();
        expect(screen.queryByTitle('Crear rol')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Editar permisos de everyone')).not.toBeInTheDocument();
    });

    it('creates a role and closes the modal', async () => {
        const created = MODERADOR;
        vi.mocked(rolesService.createRole).mockResolvedValue(created);
        const onRoleCreated = vi.fn();
        const { user } = renderSection({ onRoleCreated });

        await user.click(screen.getByTitle('Crear rol'));
        await user.type(screen.getByPlaceholderText('Moderador'), 'Moderador');
        // The + button is also named "Crear rol" (its title): target the form's submit.
        await user.click(screen.getByText('Crear rol', { selector: 'button[type="submit"]' }));

        expect(rolesService.createRole).toHaveBeenCalledWith('srv', 'Moderador');
        expect(onRoleCreated).toHaveBeenCalledWith(created);
        expect(screen.queryByPlaceholderText('Moderador')).not.toBeInTheDocument();
    });

    it('opens the permissions of the role that was clicked', async () => {
        const { user } = renderSection({ roles: [EVERYONE, MODERADOR] });

        await user.click(screen.getByTitle('Editar permisos de Moderador'));

        expect(screen.getByRole('heading', { name: 'Permisos del rol' })).toBeInTheDocument();
        expect(screen.getByText('Moderador', { selector: 'p' })).toBeInTheDocument();
    });

    // --- SCRUM-67: ver quién tiene un rol ---------------------------------

    it('lists only the members that hold the role that was asked for', async () => {
        const { user } = renderSection({
            roles: [EVERYONE, MODERADOR],
            members: [member('milton', [MODERADOR]), member('owner', [EVERYONE])],
        });

        await user.click(screen.getByTitle('Ver los miembros con el rol Moderador'));

        expect(await screen.findByText('Milton')).toBeInTheDocument();
        expect(screen.queryByText('Bruno')).not.toBeInTheDocument();
    });

    it('counts how many hold it, which is what the audit is about', async () => {
        const { user } = renderSection({
            roles: [MODERADOR],
            members: [member('milton', [MODERADOR]), member('owner', [MODERADOR])],
        });

        await user.click(screen.getByTitle('Ver los miembros con el rol Moderador'));

        expect(screen.getByText(/Miembros — 2/)).toBeInTheDocument();
    });

    it('says the role is empty instead of showing a blank list', async () => {
        // A role is created with nobody in it, so this is a normal state and not
        // an error: the text has to say how to assign it.
        const { user } = renderSection({ roles: [MODERADOR], members: [member('milton')] });

        await user.click(screen.getByTitle('Ver los miembros con el rol Moderador'));

        expect(screen.getByText(/Todavía nadie tiene este rol/)).toBeInTheDocument();
    });

    it('marks the owner, who holds every role by being the owner', async () => {
        const { user } = renderSection({
            roles: [MODERADOR],
            members: [member('owner', [MODERADOR])],
        });

        await user.click(screen.getByTitle('Ver los miembros con el rol Moderador'));

        expect(await screen.findByTitle('Dueño del servidor')).toBeInTheDocument();
    });

    it('does not offer the list to whoever cannot manage roles', () => {
        renderSection({ roles: [MODERADOR], canManage: false });

        expect(screen.queryByTitle('Ver los miembros con el rol Moderador')).not.toBeInTheDocument();
    });
});
