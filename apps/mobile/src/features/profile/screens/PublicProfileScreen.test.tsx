import { act, render, screen, userEvent } from '@testing-library/react-native';
import { PublicProfilesProvider, type PublicProfileSource } from '@discordia/core';
import type { PublicProfiles, PublicUser, Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { PublicProfileScreen } from './PublicProfileScreen';

let mockUserId = 'milton';

jest.mock('@/shared/api', () => ({ serversService: { getServers: jest.fn() } }));
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ userId: mockUserId }),
}));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useAuth: () => ({ user: { id: 'me', name: 'Felipe' } }),
}));

const milton: PublicUser = { id: 'milton', name: 'Milton', avatarUrl: 'https://cdn/milton.png', bio: 'Hago el backend' };
const server = (id: string, name: string): Server => ({
  id,
  name,
  description: null,
  owner_id: 'owner',
  avatar_url: null,
  created_at: '2026-10-01T00:00:00Z',
  channels: [],
});

const found = (...users: PublicUser[]) => async (): Promise<PublicProfiles> => new Map(users.map((u) => [u.id, u]));

const renderScreen = async (getPublicProfiles: PublicProfileSource['getPublicProfiles']) => {
  const source: PublicProfileSource = { getPublicProfiles, peekPublicProfile: () => undefined };
  const user = userEvent.setup();
  await render(
    <PublicProfilesProvider source={source}>
      <PublicProfileScreen />
    </PublicProfilesProvider>,
  );
  return { user };
};

describe('PublicProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'milton';
    jest.mocked(serversService.getServers).mockResolvedValue([]);
  });

  it('shows the name, photo and bio of the user', async () => {
    await renderScreen(found(milton));

    expect(await screen.findByText('Milton')).toBeOnTheScreen();
    expect(screen.getByLabelText('Milton')).toHaveProp('source', { uri: 'https://cdn/milton.png' });
    expect(screen.getByText('Hago el backend')).toBeOnTheScreen();
  });

  it('shows a loading state until the profile arrives', async () => {
    // render flushes the pending promises, so the request is held open to see the state in between.
    let resolve: (profiles: PublicProfiles) => void = () => undefined;
    await renderScreen(() => new Promise<PublicProfiles>((done) => (resolve = done)));

    expect(screen.getByText('Cargando perfil...')).toBeOnTheScreen();

    await act(async () => resolve(new Map([[milton.id, milton]])));
    expect(screen.getByText('Milton')).toBeOnTheScreen();
  });

  it('lists the servers in common, asking only for the ones shared with that user', async () => {
    jest.mocked(serversService.getServers).mockResolvedValue([server('s1', 'Discordia'), server('s2', 'Ingeniería')]);

    await renderScreen(found(milton));

    expect(await screen.findByText('Discordia')).toBeOnTheScreen();
    expect(screen.getByText('Ingeniería')).toBeOnTheScreen();
    expect(serversService.getServers).toHaveBeenCalledWith({ withUser: 'milton' });
  });

  it('says so when there are no servers in common', async () => {
    await renderScreen(found(milton));

    expect(await screen.findByText('No tienen servidores en común.')).toBeOnTheScreen();
  });

  it('keeps the profile visible when the servers in common fail, and retries them', async () => {
    jest.mocked(serversService.getServers).mockRejectedValueOnce(new Error('community down'));
    const { user } = await renderScreen(found(milton));

    expect(await screen.findByText(/No pudimos cargar los servidores en común/)).toBeOnTheScreen();
    expect(screen.getByText('Milton')).toBeOnTheScreen();

    jest.mocked(serversService.getServers).mockResolvedValue([server('s1', 'Discordia')]);
    await user.press(screen.getByLabelText('Reintentar'));

    expect(await screen.findByText('Discordia')).toBeOnTheScreen();
  });

  it('shows "El perfil no está disponible" for a suspended or nonexistent account', async () => {
    await renderScreen(async () => new Map());

    expect(await screen.findByText('El perfil no está disponible')).toBeOnTheScreen();
    expect(screen.getByText('Usuario no disponible')).toBeOnTheScreen();
    expect(serversService.getServers).not.toHaveBeenCalled();
  });

  it('shows an error with a retry when the profile cannot be loaded', async () => {
    const getPublicProfiles = jest.fn<ReturnType<PublicProfileSource['getPublicProfiles']>, [string[]]>();
    getPublicProfiles.mockRejectedValueOnce(new Error('network'));
    getPublicProfiles.mockImplementation(found(milton));
    const { user } = await renderScreen(getPublicProfiles);

    expect(await screen.findByText(/No pudimos cargar el perfil/)).toBeOnTheScreen();
    await user.press(screen.getByLabelText('Reintentar'));

    expect(await screen.findByText('Milton')).toBeOnTheScreen();
  });

  it('does not show servers in common on the own profile', async () => {
    mockUserId = 'me';
    await renderScreen(found({ ...milton, id: 'me', name: 'Felipe' }));

    expect(await screen.findByText('Felipe')).toBeOnTheScreen();
    expect(serversService.getServers).not.toHaveBeenCalled();
  });

  it('does not show private data', async () => {
    await renderScreen(found(milton));

    await screen.findByText('Milton');
    expect(screen.queryByText(/@/)).not.toBeOnTheScreen();
  });
});
