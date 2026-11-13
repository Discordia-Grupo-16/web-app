import { render, screen, userEvent } from '@testing-library/react-native';
import {
  MANAGE_ROLES,
  PERMISSION_COPY,
  PublicProfilesProvider,
  type PublicProfileSource,
  type RoleDeletionActor,
} from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { RolesSection } from './RolesSection';

jest.useFakeTimers();
jest.mock('@/shared/api', () => ({
  rolesService: {
    createRole: jest.fn(),
    updateRolePermissions: jest.fn(),
    setDefaultRole: jest.fn(),
    deleteRole: jest.fn(),
    listRoles: jest.fn(),
  },
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
  actor?: RoleDeletionActor;
}

const renderSection = async ({
  roles = [MODERADOR],
  members = [],
  canManage = true,
  actor,
}: Options = {}) => {
  const onRoleDeleted = jest.fn();
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
        actor={actor}
        onRoleDeleted={onRoleDeleted}
      />
    </PublicProfilesProvider>,
  );
  return { user, onRoleDeleted };
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

describe('RolesSection: eliminar un rol (SCRUM-64)', () => {
  const mine = { ...role('mine', 'Admin'), position: 5 };
  const below = { ...role('x', 'Moderador'), position: 2 };
  const everyone = { ...role('everyone', 'everyone'), is_default: true };
  const manager: RoleDeletionActor = { isOwner: false, permissions: MANAGE_ROLES, roles: [mine] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no lo ofrece sin MANAGE_ROLES', async () => {
    await renderSection({ roles: [mine, below], actor: { ...manager, permissions: 0 } });

    expect(screen.queryByLabelText('Eliminar el rol Moderador')).not.toBeOnTheScreen();
  });

  it('no lo ofrece en un rol a la altura de quien elimina', async () => {
    await renderSection({ roles: [mine, below], actor: manager });

    expect(screen.queryByLabelText('Eliminar el rol Admin')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Eliminar el rol Moderador')).toBeOnTheScreen();
  });

  it('explica el rol por defecto sin pedir confirmación', async () => {
    const { user } = await renderSection({ roles: [mine, everyone], actor: manager });

    await user.press(screen.getByLabelText('Eliminar el rol everyone'));

    expect(
      screen.getByText('Es el rol por defecto. Elegí otro rol por defecto antes de eliminarlo'),
    ).toBeOnTheScreen();
    expect(rolesService.deleteRole).not.toHaveBeenCalled();
  });

  it('elimina el rol después de confirmar y le avisa a la app', async () => {
    jest.mocked(rolesService.deleteRole).mockResolvedValue(undefined);
    const { user, onRoleDeleted } = await renderSection({ roles: [mine, below], actor: manager });

    await user.press(screen.getByLabelText('Eliminar el rol Moderador'));
    expect(screen.getByText('¿Eliminar el rol Moderador? Esta acción no se puede deshacer.')).toBeOnTheScreen();
    await user.press(screen.getByText('Eliminar'));

    expect(rolesService.deleteRole).toHaveBeenCalledWith('srv', 'x');
    expect(onRoleDeleted).toHaveBeenCalledWith('x');
  });

  it('ofrece reintentar cuando se corta la conexión', async () => {
    jest.mocked(rolesService.deleteRole).mockRejectedValue({ isAxiosError: true, response: undefined });
    jest.mocked(rolesService.listRoles).mockRejectedValue({ isAxiosError: true, response: undefined });
    const { user } = await renderSection({ roles: [mine, below], actor: manager });

    await user.press(screen.getByLabelText('Eliminar el rol Moderador'));
    await user.press(screen.getByText('Eliminar'));

    expect(await screen.findByText('Reintentar')).toBeOnTheScreen();
    expect(screen.getByText('No hay conexión.')).toBeOnTheScreen();
  });
});
