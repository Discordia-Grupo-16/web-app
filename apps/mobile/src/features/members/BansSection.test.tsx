import { render, screen, userEvent } from '@testing-library/react-native';
import { PERMISSION_COPY, PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, ServerBan } from '@discordia/api';
import { membersService } from '@/shared/api';
import { BansSection } from './BansSection';

jest.useFakeTimers();
jest.mock('@/shared/api', () => ({ membersService: { revokeBan: jest.fn() } }));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useAuth: () => ({ user: { id: 'me', name: 'Felipe', avatarUrl: null } }),
}));

const ban = (userId: string, reason: string | null = null): ServerBan => ({
  user_id: userId,
  banned_by: 'owner',
  reason,
  // Sin zona, como lo manda `community`, y al mediodía para que ninguna zona lo pase de día.
  created_at: '2026-10-01T12:00:00',
});

const profiles: PublicProfiles = new Map([
  ['milton', { id: 'milton', name: 'Milton', avatarUrl: null, bio: null }],
  ['owner', { id: 'owner', name: 'Bruno', avatarUrl: null, bio: null }],
]);

const renderSection = async (bans: ServerBan[] = [ban('milton', 'spam')]) => {
  const onBanRevoked = jest.fn();
  const source: PublicProfileSource = {
    getPublicProfiles: async () => profiles,
    peekPublicProfile: () => undefined,
  };
  const user = userEvent.setup();
  await render(
    <PublicProfilesProvider source={source}>
      <BansSection serverId="srv" bans={bans} onBanRevoked={onBanRevoked} />
    </PublicProfilesProvider>,
  );
  return { onBanRevoked, user };
};

describe('BansSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra quién está baneado, quién lo baneó y por qué, igual que la web', async () => {
    // Los dos nombres son de `identity`: el del moderador sale del mismo pedido.
    await renderSection();

    expect(await screen.findByText('Milton')).toBeOnTheScreen();
    expect(await screen.findByText(/^Baneado por Bruno el /)).toBeOnTheScreen();
    expect(screen.getByText(PERMISSION_COPY.banReason('spam'))).toBeOnTheScreen();
  });

  it('cuenta los baneos', async () => {
    await renderSection([ban('milton'), ban('caro')]);

    expect(screen.getByText(PERMISSION_COPY.bansTitle(2))).toBeOnTheScreen();
  });

  it('sin motivo no muestra la línea', async () => {
    await renderSection([ban('milton')]);
    await screen.findByText('Milton');

    expect(screen.queryByText(/^Motivo:/)).not.toBeOnTheScreen();
  });

  it('avisa cuando no hay nadie baneado', async () => {
    await renderSection([]);

    expect(screen.getByText(PERMISSION_COPY.noBans)).toBeOnTheScreen();
  });

  it('avisa que revocar no lo trae de vuelta solo, igual que la web', async () => {
    const { user } = await renderSection();
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.revokeBan('Milton')));

    expect(screen.getByText(PERMISSION_COPY.revokeBanWarning('Milton'))).toBeOnTheScreen();
  });

  it('revoca y avisa para que la fila se vaya', async () => {
    jest.mocked(membersService.revokeBan).mockResolvedValue(undefined);
    const { user, onBanRevoked } = await renderSection();
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.revokeBan('Milton')));
    await user.press(screen.getByRole('button', { name: PERMISSION_COPY.revokeConfirm }));

    expect(membersService.revokeBan).toHaveBeenCalledWith('srv', 'milton');
    expect(onBanRevoked).toHaveBeenCalledWith('milton');
  });

  it('muestra por qué el backend se negó y deja la fila', async () => {
    jest.mocked(membersService.revokeBan).mockRejectedValue({
      response: { data: { detail: 'No tenés permiso para revocar baneos en este servidor' } },
    });
    const { user, onBanRevoked } = await renderSection();
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.revokeBan('Milton')));
    await user.press(screen.getByRole('button', { name: PERMISSION_COPY.revokeConfirm }));

    expect(await screen.findByText(/No tenés permiso/)).toBeOnTheScreen();
    expect(onBanRevoked).not.toHaveBeenCalled();
  });

  it('no revoca si se cancela el diálogo', async () => {
    const { user, onBanRevoked } = await renderSection();
    await screen.findByText('Milton');

    await user.press(screen.getByLabelText(PERMISSION_COPY.revokeBan('Milton')));
    await user.press(screen.getByText(PERMISSION_COPY.revokeCancel));

    expect(membersService.revokeBan).not.toHaveBeenCalled();
    expect(onBanRevoked).not.toHaveBeenCalled();
  });
});
