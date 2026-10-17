import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { RolesSection } from './RolesSection';

vi.mock('@/shared/api', () => ({
    rolesService: { createRole: vi.fn(), updateRolePermissions: vi.fn() },
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

describe('RolesSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lists the roles and hides the create button for members who cannot manage', () => {
        render(<RolesSection serverId="srv" roles={[role('r1', 'everyone')]} canManage={false} onRoleCreated={vi.fn()} onRoleUpdated={vi.fn()} />);
        expect(screen.getByText('everyone')).toBeInTheDocument();
        expect(screen.queryByTitle('Crear rol')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Editar permisos de everyone')).not.toBeInTheDocument();
    });

    it('creates a role and closes the modal', async () => {
        const created = role('r2', 'Moderador');
        vi.mocked(rolesService.createRole).mockResolvedValue(created);
        const onRoleCreated = vi.fn();
        render(<RolesSection serverId="srv" roles={[]} canManage onRoleCreated={onRoleCreated} onRoleUpdated={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(screen.getByTitle('Crear rol'));
        await user.type(screen.getByPlaceholderText('Moderador'), 'Moderador');
        // The + button is also named "Crear rol" (its title): target the form's submit.
        await user.click(screen.getByText('Crear rol', { selector: 'button[type="submit"]' }));

        expect(rolesService.createRole).toHaveBeenCalledWith('srv', 'Moderador');
        expect(onRoleCreated).toHaveBeenCalledWith(created);
        expect(screen.queryByPlaceholderText('Moderador')).not.toBeInTheDocument();
    });

    it('opens the permissions of the role that was clicked', async () => {
        render(<RolesSection serverId="srv" roles={[role('r1', 'everyone'), role('r2', 'Moderador')]} canManage onRoleCreated={vi.fn()} onRoleUpdated={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(screen.getByTitle('Editar permisos de Moderador'));

        expect(screen.getByRole('heading', { name: 'Permisos del rol' })).toBeInTheDocument();
        expect(screen.getByText('Moderador', { selector: 'p' })).toBeInTheDocument();
    });
});
