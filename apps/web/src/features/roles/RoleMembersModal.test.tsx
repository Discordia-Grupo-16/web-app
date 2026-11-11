import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '@discordia/api';
import { RoleMembersModal } from './RoleMembersModal';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: 'me', name: 'Ana', avatarUrl: null } }),
    usePublicProfiles: () => new Map(),
}));

const role: Role = {
    id: 'r1',
    server_id: 'srv',
    name: 'Moderador',
    is_default: false,
    permissions: 0,
    permission_names: [],
    position: 1,
    created_at: '2026-10-01T00:00:00Z',
};

describe('RoleMembersModal', () => {
    it('only says the role no longer exists when it was deleted', () => {
        render(
            <RoleMembersModal
                role={role}
                members={[{ user_id: 'me', joined_at: '2026-10-01T00:00:00Z', roles: [role] }]}
                ownerId="owner"
                onClose={vi.fn()}
                roleGone
            />,
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Ese rol ya no existe');
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });
});
