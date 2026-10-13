import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { PERMISSION_COPY, PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, Role, ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { MembersSection } from './MembersSection';

jest.useFakeTimers();
jest.mock('@/shared/api', () => ({
  rolesService: { assignRole: jest.fn(), removeRole: jest.fn() },
}));
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
}

const renderSection = async ({
  members = [member('milton')],
  roles = [MODERADOR, ADMIN],
  canManage = true,
}: Options = {}) => {
  const onRolesChange = jest.fn();
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
        onRolesChange={onRolesChange}
      />
    </PublicProfilesProvider>,
  );
  return { onRolesChange, user };
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
