import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { PERMISSION_COPY, PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { membersService, rolesService } from '@/shared/api';
import { MembersSection } from './MembersSection';

jest.useFakeTimers();
jest.mock('@/shared/api', () => ({
  rolesService: { assignRole: jest.fn(), removeRole: jest.fn() },
  membersService: { banMember: jest.fn() },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
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
  canBan?: boolean;
}

const renderSection = async ({
  members = [member('milton')],
  roles = [MODERADOR, ADMIN],
  canManage = true,
  canBan = false,
}: Options = {}) => {
  const onRolesChange = jest.fn();
  const onMemberBanned = jest.fn();
  const source: PublicProfileSource = {
    getPublicProfiles: async () => profiles,
    peekPublicProfile: () => undefined,
  };
  const user = userEvent.setup();
  await render(
    <PublicProfilesProvider source={source}>
      <MembersSection
        serverId="srv"
        members={members}
        roles={roles}
        ownerId="owner"
        canManage={canManage}
        canBan={canBan}
        onRolesChange={onRolesChange}
        onMemberBanned={onMemberBanned}
      />
    </PublicProfilesProvider>,
  );
  return { onRolesChange, onMemberBanned, user };
};

// A Switch reports through onValueChange, and act() is what flushes the re-render.
const toggleRole = (name: string, value: boolean) =>
  act(async () => {
    fireEvent(screen.getByLabelText(name), 'valueChange', value);
  });

describe('MembersSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the name of each member instead of their id', async () => {
    await renderSection();

    expect(await screen.findByText('Milton')).toBeOnTheScreen();
  });

  it('counts the members', async () => {
    await renderSection({ members: [member('milton'), member('owner')] });

    expect(screen.getByText(PERMISSION_COPY.membersTitle(2))).toBeOnTheScreen();
  });

  it('names the member by their highest role', async () => {
    // The list arrives ordered by position, so the last one is the highest: it is the one the
    // backend's hierarchy uses to decide who can act on whom.
    await renderSection({ members: [member('milton', [MODERADOR, ADMIN])] });

    expect(await screen.findByText('Admin')).toBeOnTheScreen();
    expect(screen.queryByText('Moderador')).not.toBeOnTheScreen();
  });

  it('hides the edit affordance from whoever cannot manage roles', async () => {
    await renderSection({ canManage: false });
    await screen.findByText('Milton');

    expect(screen.queryByLabelText(PERMISSION_COPY.editMemberRoles('Milton'))).not.toBeOnTheScreen();
  });

  it('does not offer to edit the roles of the owner', async () => {
    // Nobody is above the owner, so the backend refuses it: offering it would only produce a 403.
    await renderSection({ members: [member('owner')] });

    expect(await screen.findByText('Bruno')).toBeOnTheScreen();
    expect(screen.queryByLabelText(PERMISSION_COPY.editMemberRoles('Bruno'))).not.toBeOnTheScreen();
  });

  it('gives a role and reports the new list', async () => {
    jest.mocked(rolesService.assignRole).mockResolvedValue();
    const { user, onRolesChange } = await renderSection();
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.editMemberRoles('Milton')));
    await toggleRole('Moderador', true);

    expect(rolesService.assignRole).toHaveBeenCalledWith('srv', 'r1', 'milton');
    expect(onRolesChange).toHaveBeenCalledWith('milton', [MODERADOR]);
  });

  it('takes a role away and keeps the rest', async () => {
    // The effective permission is the OR of every role: removing one must not touch what the
    // others grant.
    jest.mocked(rolesService.removeRole).mockResolvedValue();
    const { user, onRolesChange } = await renderSection({
      members: [member('milton', [MODERADOR, ADMIN])],
    });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.editMemberRoles('Milton')));
    await toggleRole('Moderador', false);

    expect(rolesService.removeRole).toHaveBeenCalledWith('srv', 'r1', 'milton');
    expect(onRolesChange).toHaveBeenCalledWith('milton', [ADMIN]);
  });

  it('shows the reason when the backend refuses and changes nothing', async () => {
    jest.mocked(rolesService.assignRole).mockRejectedValue({
      response: {
        data: { detail: 'No podés gestionar un rol que está en tu misma posición o por encima' },
      },
    });
    const { user, onRolesChange } = await renderSection();
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.editMemberRoles('Milton')));
    await toggleRole('Admin', true);

    expect(await screen.findByText(/por encima/)).toBeOnTheScreen();
    expect(onRolesChange).not.toHaveBeenCalled();
  });

  it('says what to do when the server has no roles yet', async () => {
    const { user } = await renderSection({ roles: [] });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.editMemberRoles('Milton')));

    expect(screen.getByText(PERMISSION_COPY.noRolesYet)).toBeOnTheScreen();
  });
});

describe('MembersSection: el perfil público', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no ofrece banear a quien no tiene BAN_MEMBERS', async () => {
    await renderSection({ canBan: false });
    await screen.findByText('Milton');

    expect(screen.queryByLabelText(PERMISSION_COPY.banMember('Milton'))).toBeNull();
  });

  it('nunca ofrece banear al dueño, que el backend rechaza', async () => {
    // Mostrarlo sería un botón cuyo único resultado posible es un 403.
    await renderSection({ members: [member('owner')], canBan: true });
    await screen.findByText('Bruno');

    expect(screen.queryByLabelText(PERMISSION_COPY.banMember('Bruno'))).toBeNull();
  });

  it('nunca ofrece banearse a uno mismo', async () => {
    await renderSection({ members: [member('me')], canBan: true });

    expect(screen.queryByLabelText(/^Banear a /)).toBeNull();
  });

  it('avisa que ninguna invitación lo trae de vuelta, igual que la web', async () => {
    const { user } = await renderSection({ canBan: true });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.banMember('Milton')));

    expect(
      screen.getByText(PERMISSION_COPY.banMemberWarning('Milton')),
    ).toBeOnTheScreen();
  });

  it('banea con el motivo y saca al miembro de la lista', async () => {
    (membersService.banMember as jest.Mock).mockResolvedValue(undefined);
    const { user, onMemberBanned } = await renderSection({ canBan: true });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.banMember('Milton')));
    await user.type(screen.getByLabelText(PERMISSION_COPY.banReasonLabel), 'spam');
    await user.press(screen.getByText(PERMISSION_COPY.banConfirm));

    expect(membersService.banMember).toHaveBeenCalledWith('srv', 'milton', 'spam');
    expect(onMemberBanned).toHaveBeenCalledWith('milton');
  });

  it('muestra por qué el backend se negó y deja al miembro en la lista', async () => {
    // La jerarquía es del backend: esta pantalla no conoce los roles de quien
    // banea, así que lo único honesto que puede hacer es repetir la negativa.
    (membersService.banMember as jest.Mock).mockRejectedValue({
      response: {
        data: { detail: 'No podés moderar a un miembro con jerarquía igual o superior a la tuya' },
      },
    });
    const { user, onMemberBanned } = await renderSection({ canBan: true });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.banMember('Milton')));
    await user.press(screen.getByText(PERMISSION_COPY.banConfirm));

    expect(await screen.findByText(/jerarquía igual o superior/)).toBeOnTheScreen();
    expect(onMemberBanned).not.toHaveBeenCalled();
  });

  it('no se puede cerrar con el botón atrás mientras el baneo está en vuelo', async () => {
    // El equivalente del fondo y la X de la web: `onRequestClose` es el botón
    // atrás de Android y no miraba `banning`. Si se cierra con la request
    // empezada y el backend la rechaza, el error no se ve nunca.
    (membersService.banMember as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { user } = await renderSection({ canBan: true });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.banMember('Milton')));
    await user.press(screen.getByText(PERMISSION_COPY.banConfirm));
    // `fireEvent` sube por los ancestros buscando el handler, así que
    // disparándolo sobre el título llega al `onRequestClose` del Modal. RNTL 14
    // ya no expone queries por tipo de componente.
    await act(async () => {
      fireEvent(screen.getByText(PERMISSION_COPY.banMemberTitle), 'requestClose');
    });

    expect(screen.getByText(PERMISSION_COPY.banMemberWarning('Milton'))).toBeOnTheScreen();
  });

  it('no banea si se cancela el diálogo', async () => {
    const { user, onMemberBanned } = await renderSection({ canBan: true });
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.banMember('Milton')));
    await user.press(screen.getByText(PERMISSION_COPY.banCancel));

    expect(membersService.banMember).not.toHaveBeenCalled();
    expect(onMemberBanned).not.toHaveBeenCalled();
  });

  it('abre el perfil del miembro que se toca, igual que la web', async () => {
    const { user } = await renderSection();

    await user.press(await screen.findByText('Milton'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/user/[userId]',
      params: { userId: 'milton' },
    });
  });

  it('el nombre abre el perfil también para quien no gestiona roles', async () => {
    // Las dos acciones están separadas: el nombre lleva al perfil y el lápiz a
    // los roles, así que perder MANAGE_ROLES no esconde el perfil.
    const { user } = await renderSection({ canManage: false });

    await user.press(await screen.findByText('Milton'));

    expect(mockPush).toHaveBeenCalled();
  });
});
