import { render, screen } from '@testing-library/react-native';
import type { Role } from '@discordia/api';
import { RoleMembersModal } from './RoleMembersModal';

jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
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
  it('only says the role no longer exists when it was deleted', async () => {
    await render(
      <RoleMembersModal
        visible
        role={role}
        members={[{ user_id: 'me', joined_at: '2026-10-01T00:00:00Z', roles: [role] }]}
        ownerId="owner"
        onClose={jest.fn()}
        roleGone
      />,
    );

    expect(screen.getByText('Ese rol ya no existe')).toBeOnTheScreen();
    expect(screen.queryByText('Ana')).not.toBeOnTheScreen();
  });
});
