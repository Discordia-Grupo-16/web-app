import { render, screen, userEvent } from '@testing-library/react-native';
import { PERMISSION_COPY, PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { RolesSection } from './RolesSection';

jest.useFakeTimers();
jest.mock('@/shared/api', () => ({
  rolesService: { createRole: jest.fn(), updateRolePermissions: jest.fn(), setDefaultRole: jest.fn() },
}));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
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

const MODERADOR = role('r2', 'Moderador');
const EVERYONE = role('r1', 'everyone');

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
}

const renderSection = async ({
  roles = [MODERADOR],
  members = [],
  canManage = true,
}: Options = {}) => {
  const source: PublicProfileSource = {
    getPublicProfiles: async () => profiles,
    peekPublicProfile: () => undefined,
  };
  const user = userEvent.setup();
  await render(
    <PublicProfilesProvider source={source}>
      <RolesSection
        serverId="srv"
        roles={roles}
        members={members}
        ownerId="owner"
        canManage={canManage}
        onRoleCreated={jest.fn()}
        onRoleUpdated={jest.fn()}
      />
    </PublicProfilesProvider>,
  );
  return { user };
};

const openMembersOf = (roleName: string) =>
  screen.getByLabelText(PERMISSION_COPY.viewRoleMembers(roleName));

describe('RolesSection: ver quién tiene un rol (SCRUM-67)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista solo a los miembros que tienen el rol que se pidió', async () => {
    const { user } = await renderSection({
      roles: [EVERYONE, MODERADOR],
      members: [member('milton', [MODERADOR]), member('owner', [EVERYONE])],
    });

    await user.press(openMembersOf('Moderador'));

    expect(await screen.findByText('Milton')).toBeOnTheScreen();
    expect(screen.queryByText('Bruno')).toBeNull();
  });

  it('cuenta cuántos lo tienen, que es de lo que se trata la auditoría', async () => {
    const { user } = await renderSection({
      members: [member('milton', [MODERADOR]), member('owner', [MODERADOR])],
    });

    await user.press(openMembersOf('Moderador'));

    expect(screen.getByText(new RegExp(PERMISSION_COPY.membersTitle(2)))).toBeOnTheScreen();
  });

  it('dice que el rol está vacío en vez de mostrar una lista en blanco', async () => {
    // Un rol se crea sin nadie, así que es un estado normal y no un error: el
    // texto tiene que decir cómo se asigna.
    const { user } = await renderSection({ members: [member('milton')] });

    await user.press(openMembersOf('Moderador'));

    expect(screen.getByText(PERMISSION_COPY.noMembersWithRole)).toBeOnTheScreen();
  });

  it('marca al dueño, que tiene todos los roles por ser el dueño', async () => {
    const { user } = await renderSection({ members: [member('owner', [MODERADOR])] });

    await user.press(openMembersOf('Moderador'));

    expect(await screen.findByLabelText(PERMISSION_COPY.ownerMark)).toBeOnTheScreen();
  });

  it('no le ofrece la lista a quien no gestiona roles', async () => {
    await renderSection({ canManage: false });

    expect(screen.queryByLabelText(PERMISSION_COPY.viewRoleMembers('Moderador'))).toBeNull();
  });

  it('las dos acciones de la fila son distintas: miembros y permisos', async () => {
    // Antes el nombre entero abría los permisos. Si volviera a ser así, la
    // acción de miembros quedaría tapada por la de permisos.
    const { user } = await renderSection();

    await user.press(openMembersOf('Moderador'));

    expect(screen.getByText(PERMISSION_COPY.roleMembersTitle)).toBeOnTheScreen();
    expect(screen.queryByText(PERMISSION_COPY.rolePermissionsTitle)).toBeNull();
  });
});
