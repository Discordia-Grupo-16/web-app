import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSION_COPY } from '@discordia/core';
import type { Role } from '@discordia/api';
import { RolesGroup } from './RolesGroup';

const role = (id: string, name: string, is_default = false): Role => ({
    id,
    server_id: 'srv',
    name,
    is_default,
    permissions: 0,
    permission_names: [],
    position: 1,
    created_at: '2026-10-01T00:00:00Z',
});

const renderGroup = (roles: Role[], { canManage = true, canDelete = false } = {}) =>
    render(
        <RolesGroup
            roles={roles}
            canManage={canManage}
            onAdd={vi.fn()}
            onEdit={vi.fn()}
            onViewMembers={vi.fn()}
            canDelete={() => canDelete}
            onDelete={vi.fn()}
        />,
    );

describe('RolesGroup', () => {
    it('keeps the buttons out of the way of the name, in a floating container apart from it', () => {
        renderGroup([role('r1', 'Moderador'), role('r2', 'Admin')], { canDelete: true });

        const actions = screen.getByTestId('role-actions-r1');
        expect(actions).not.toContainElement(screen.getByText('Moderador'));
        expect(actions).toContainElement(screen.getByTitle(PERMISSION_COPY.viewRoleMembers('Moderador')));
        expect(actions).toContainElement(screen.getByTitle(PERMISSION_COPY.editRolePermissions('Moderador')));
        // Out of the flow, hidden and not clickable until hover or keyboard focus.
        expect(actions).toHaveClass('absolute', 'opacity-0', 'pointer-events-none');
        expect(actions).toHaveClass('group-hover/role:pointer-events-auto', 'group-focus-within/role:pointer-events-auto');
        expect(actions).toHaveClass('[@media(hover:none)]:static', '[@media(hover:none)]:flex-wrap');
    });

    it('shows the "Por defecto" badge in the line of the name, never cut', () => {
        renderGroup([role('r1', 'everyone', true)]);

        const badge = screen.getByText(PERMISSION_COPY.defaultRoleBadge);
        expect(badge).toHaveClass('shrink-0');
        expect(screen.getByText('everyone').parentElement).toContainElement(badge);
        expect(screen.getByTestId('role-actions-r1')).not.toContainElement(badge);
    });

    it('does not draw the actions container when the role has no buttons', () => {
        renderGroup([role('r1', 'Moderador')], { canManage: false, canDelete: false });

        expect(screen.queryByTestId('role-actions-r1')).not.toBeInTheDocument();
    });
});
