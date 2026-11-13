import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANAGE_ROLES, PublicProfilesProvider, type PublicProfileSource, type RoleDeletionActor } from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { RolesSection } from './RolesSection';

vi.mock('@/shared/api', () => ({
    rolesService: { createRole: vi.fn(), updateRolePermissions: vi.fn(), deleteRole: vi.fn(), listRoles: vi.fn() },
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
    actor?: RoleDeletionActor;
}

const renderSection = ({
    roles = [],
    members = [],
    canManage = true,
    onRoleCreated = vi.fn(),
    actor,
}: Options = {}) => {
    const source: PublicProfileSource = {
        getPublicProfiles: async () => profiles,
        peekPublicProfile: () => undefined,
    };
    const onRoleDeleted = vi.fn();
    const section = (current: Role[]) => (
        <PublicProfilesProvider source={source}>
            <RolesSection
                serverId="srv"
                roles={current}
                members={members}
                ownerId="owner"
                canManage={canManage}
                onRoleCreated={onRoleCreated}
                onRoleUpdated={vi.fn()}
                actor={actor}
                onRoleDeleted={onRoleDeleted}
            />
        </PublicProfilesProvider>
    );
    const { rerender } = render(section(roles));
    return { user: userEvent.setup(), onRoleDeleted, rerender: (next: Role[]) => rerender(section(next)) };
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

describe('RolesSection deleting a role', () => {
    const mine = { ...role('mine', 'Admin'), position: 5 };
    const below = { ...role('x', 'Moderador'), position: 2 };
    const everyone = { ...role('everyone', 'everyone'), is_default: true };
    const manager: RoleDeletionActor = { isOwner: false, permissions: MANAGE_ROLES, roles: [mine] };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not offer it without MANAGE_ROLES', () => {
        renderSection({ roles: [mine, below], actor: { ...manager, permissions: 0 } });

        expect(screen.queryByRole('button', { name: 'Eliminar el rol Moderador' })).not.toBeInTheDocument();
    });

    it('does not offer it on a role at the height of whoever deletes', () => {
        renderSection({ roles: [mine, below], actor: manager });

        expect(screen.queryByRole('button', { name: 'Eliminar el rol Admin' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Eliminar el rol Moderador' })).toBeInTheDocument();
    });

    it('explains the default role without asking to confirm', async () => {
        const { user } = renderSection({ roles: [mine, everyone], actor: manager });

        await user.click(screen.getByRole('button', { name: 'Eliminar el rol everyone' }));

        expect(screen.getByText('Es el rol por defecto. Elegí otro rol por defecto antes de eliminarlo')).toBeInTheDocument();
        expect(rolesService.deleteRole).not.toHaveBeenCalled();
    });

    it('deletes the role after confirming and tells the app', async () => {
        vi.mocked(rolesService.deleteRole).mockResolvedValue(undefined);
        const { user, onRoleDeleted } = renderSection({ roles: [mine, below], actor: manager });

        await user.click(screen.getByRole('button', { name: 'Eliminar el rol Moderador' }));
        await user.click(screen.getByRole('button', { name: 'Eliminar' }));

        expect(rolesService.deleteRole).toHaveBeenCalledWith('srv', 'x');
        expect(onRoleDeleted).toHaveBeenCalledWith('x');
    });

    it('offers to retry when the connection is lost', async () => {
        vi.mocked(rolesService.deleteRole).mockRejectedValue({ isAxiosError: true, response: undefined });
        vi.mocked(rolesService.listRoles).mockRejectedValue({ isAxiosError: true, response: undefined });
        const { user } = renderSection({ roles: [mine, below], actor: manager });

        await user.click(screen.getByRole('button', { name: 'Eliminar el rol Moderador' }));
        await user.click(screen.getByRole('button', { name: 'Eliminar' }));

        expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });

    it('says the role no longer exists in an open permissions modal when it leaves the list', async () => {
        const { user, rerender } = renderSection({ roles: [mine, below], actor: manager });
        await user.click(screen.getByTitle('Editar permisos de Moderador'));

        rerender([mine]);

        expect(screen.getByRole('alert')).toHaveTextContent('Ese rol ya no existe');
    });
});
