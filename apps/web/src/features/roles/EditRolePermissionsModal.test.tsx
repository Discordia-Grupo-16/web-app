import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMINISTRATOR, PERMISSION_COPY, SEND_MESSAGES, VIEW_CHANNEL } from '@discordia/core';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { EditRolePermissionsModal } from './EditRolePermissionsModal';

vi.mock('@/shared/api', () => ({
    rolesService: { updateRolePermissions: vi.fn(), setDefaultRole: vi.fn() },
}));

const role = (permissions: number, is_default = false): Role => ({
    id: 'r1',
    server_id: 'srv',
    name: 'Moderador',
    is_default,
    permissions,
    permission_names: [],
    position: 1,
    created_at: '2026-10-01T00:00:00Z',
});

const renderModal = (permissions: number, isDefault = false) => {
    const onUpdated = vi.fn();
    const onClose = vi.fn();
    render(
        <EditRolePermissionsModal
            serverId="srv"
            role={role(permissions, isDefault)}
            onClose={onClose}
            onUpdated={onUpdated}
        />,
    );
    return { onUpdated, onClose, user: userEvent.setup() };
};

const save = () => screen.getByRole('button', { name: 'Guardar cambios' });

describe('EditRolePermissionsModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('ticks the permissions the role already has, and only those', () => {
        renderModal(VIEW_CHANNEL | SEND_MESSAGES);

        expect(screen.getByRole('checkbox', { name: 'Ver canales' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Enviar mensajes' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'Banear miembros' })).not.toBeChecked();
    });

    it('sends the whole resulting list, not just what changed', async () => {
        // The endpoint replaces the permissions: sending only the new one would silently
        // revoke the rest.
        vi.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(3));
        const { user } = renderModal(VIEW_CHANNEL);

        await user.click(screen.getByRole('checkbox', { name: 'Enviar mensajes' }));
        await user.click(save());

        expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', [
            'VIEW_CHANNEL',
            'SEND_MESSAGES',
        ]);
    });

    it('lets a permission be taken away', async () => {
        vi.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(VIEW_CHANNEL));
        const { user } = renderModal(VIEW_CHANNEL | SEND_MESSAGES);

        await user.click(screen.getByRole('checkbox', { name: 'Enviar mensajes' }));
        await user.click(save());

        expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', [
            'VIEW_CHANNEL',
        ]);
    });

    it('allows leaving the role with no permission at all', async () => {
        vi.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(0));
        const { user } = renderModal(VIEW_CHANNEL);

        await user.click(screen.getByRole('checkbox', { name: 'Ver canales' }));
        await user.click(save());

        expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', []);
    });

    it('hands the updated role back and closes', async () => {
        const updated = role(VIEW_CHANNEL | SEND_MESSAGES);
        vi.mocked(rolesService.updateRolePermissions).mockResolvedValue(updated);
        const { user, onUpdated } = renderModal(VIEW_CHANNEL);

        await user.click(screen.getByRole('checkbox', { name: 'Enviar mensajes' }));
        await user.click(save());

        expect(onUpdated).toHaveBeenCalledWith(updated);
    });

    it('does not save when nothing changed', () => {
        // Every save publishes an event to the bus and re-resolves the permissions of every
        // member: sending one that changes nothing is pure noise.
        renderModal(VIEW_CHANNEL);

        expect(save()).toBeDisabled();
    });

    it('warns that ADMINISTRATOR overrides the rest of the boxes', async () => {
        const { user } = renderModal(VIEW_CHANNEL);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: 'Administrador' }));

        expect(screen.getByRole('status')).toHaveTextContent(/todos los permisos/i);
    });

    it('shows the reason when the backend refuses', async () => {
        // The hierarchy is only known by the backend: this screen does not know which roles the
        // caller has, so it reports instead of guessing.
        vi.mocked(rolesService.updateRolePermissions).mockRejectedValue({
            response: { data: { detail: 'No podés editar un rol igual o superior al tuyo' } },
        });
        const { user, onUpdated } = renderModal(VIEW_CHANNEL);

        await user.click(screen.getByRole('checkbox', { name: 'Administrador' }));
        await user.click(save());

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'No podés editar un rol igual o superior al tuyo',
        );
        expect(onUpdated).not.toHaveBeenCalled();
    });

    it('keeps ADMINISTRATOR out of the mask it sends unless it is ticked', async () => {
        vi.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(ADMINISTRATOR));
        const { user } = renderModal(0);

        await user.click(screen.getByRole('checkbox', { name: 'Administrador' }));
        await user.click(save());

        expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', [
            'ADMINISTRATOR',
        ]);
    });
});

describe('el rol por defecto (SCRUM-63)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('ofrece marcarlo cuando no lo es', async () => {
        vi.mocked(rolesService.setDefaultRole).mockResolvedValue();
        const { user, onUpdated } = renderModal(VIEW_CHANNEL);

        await user.click(screen.getByText(PERMISSION_COPY.makeDefaultRole));

        expect(rolesService.setDefaultRole).toHaveBeenCalledWith('srv', 'r1');
        expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ is_default: true }));
    });

    it('dice que ya lo es, en vez de ofrecerlo', () => {
        renderModal(VIEW_CHANNEL, true);

        expect(screen.getByText(PERMISSION_COPY.isDefaultRole)).toBeInTheDocument();
        expect(screen.queryByText(PERMISSION_COPY.makeDefaultRole)).not.toBeInTheDocument();
    });

    it('muestra el motivo cuando el backend lo rechaza', async () => {
        // La jerarquía: marcar como defecto un rol más alto sería dárselo a
        // todo el que entre.
        vi.mocked(rolesService.setDefaultRole).mockRejectedValue({
            response: {
                data: { detail: 'No podés marcar como rol por defecto uno que está en tu misma posición o por encima' },
            },
        });
        const { user, onUpdated } = renderModal(VIEW_CHANNEL);

        await user.click(screen.getByText(PERMISSION_COPY.makeDefaultRole));

        expect(await screen.findByRole('alert')).toHaveTextContent(/por encima/);
        expect(onUpdated).not.toHaveBeenCalled();
    });
});
