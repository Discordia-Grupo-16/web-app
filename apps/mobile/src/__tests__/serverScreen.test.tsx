import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { OwnershipTransfer, Server, ServerMember } from '@discordia/api';
import { ADMINISTRATOR, PublicProfilesProvider, VIEW_CHANNEL } from '@discordia/core';
import { membersService, ownershipSource, serversService } from '@/shared/api';
import ServerScreen from '@/app/(app)/server/[serverId]/index';

const ME = 'me';
// Stable, like the real ones: the screen lists them as effect dependencies.
const mockNavigation = { setOptions: jest.fn() };
const mockRouter = { back: jest.fn() };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ serverId: 'srv' }),
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  // useLiveRefresh follows the focus with it; this screen is never unfocused here.
  useFocusEffect: () => undefined,
}));
jest.mock('@/shared/hooks/useFocusedPolling', () => ({ useFocusedPolling: () => undefined }));
jest.mock('@/shared/api', () => ({
  serversService: { getServer: jest.fn(), leaveServer: jest.fn() },
  membersService: { listMembers: jest.fn(), listBans: jest.fn(), kickMember: jest.fn(), banMember: jest.fn() },
  ownershipSource: {
    getServerTransfer: jest.fn(),
    proposeTransfer: jest.fn(),
    cancelTransfer: jest.fn(),
    acceptTransfer: jest.fn(),
    rejectTransfer: jest.fn(),
    listMyTransfers: jest.fn(),
    getServer: jest.fn(),
    getServers: jest.fn(),
  },
  voiceService: { getServerVoiceParticipants: jest.fn() },
}));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useAuth: () => ({ user: { id: ME, name: 'Yo', avatarUrl: null } }),
  useVoice: () => ({ call: { status: 'idle' } }),
  useVoiceCallParticipants: () => [],
  // The voice roster under the channels has its own tests (serverScreenVoice.test.tsx).
  useServerVoiceRoster: () => new Map(),
  useVoiceRosterViews: () => new Map(),
}));
// The other sections have their own tests: here only the members, the transfer and the leave matter.
jest.mock('@/features/channels', () => ({ ChannelSection: () => null }));
jest.mock('@/features/roles', () => ({
  RolesSection: () => null,
  useRoles: () => ({ roles: [], loading: false, addRole: jest.fn(), updateRole: jest.fn() }),
}));
jest.mock('@/features/invitations', () => ({ InvitationsSection: () => null }));
jest.mock('@/features/voice', () => ({ VoiceParticipantList: () => null }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

const server = (myPermissions: number, ownerId: string): Server => ({
  id: 'srv',
  name: 'Discordia',
  description: null,
  owner_id: ownerId,
  avatar_url: null,
  banner_url: null,
  created_at: '2026-10-01T00:00:00Z',
  my_permissions: myPermissions,
  my_permission_names: [],
  channels: [],
});

const member = (userId: string): ServerMember => ({ user_id: userId, joined_at: '2026-10-01T00:00:00Z', roles: [] });

const PENDING_TO_MILTON: OwnershipTransfer = {
  server_id: 'srv',
  server_name: 'Discordia',
  from_user_id: ME,
  to_user_id: 'milton',
  status: 'pending',
  created_at: '2026-11-05T10:00:00Z',
  resolved_at: null,
};

const profiles = {
  getPublicProfiles: async (ids: string[]) =>
    new Map(ids.map((id) => [id, { id, name: id === 'milton' ? 'Milton' : 'Yo', avatarUrl: null, bio: null }] as const)),
  peekPublicProfile: () => undefined,
};

const renderScreen = async (myPermissions: number, ownerId: string) => {
  jest.mocked(serversService.getServer).mockResolvedValue(server(myPermissions, ownerId));
  jest.mocked(membersService.listMembers).mockResolvedValue([member(ME), member('milton')]);
  jest.mocked(membersService.listBans).mockResolvedValue([]);
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PublicProfilesProvider source={profiles}>
        <ServerScreen />
      </PublicProfilesProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText('Abandonar servidor')).toBeOnTheScreen());
};

const transferButtons = () => screen.queryAllByLabelText('Transferir servidor');

describe('la pantalla del servidor: transferir la propiedad (SCRUM-35, Transferir propiedad del servidor)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ownershipSource.getServerTransfer).mockRejectedValue({ isAxiosError: true, response: { status: 404 } });
  });

  it('el dueño la ve en la fila de los demás y no en la suya', async () => {
    await renderScreen(VIEW_CHANNEL, ME);

    await waitFor(() => expect(transferButtons()).toHaveLength(1));
  });

  it('un miembro con ADMINISTRATOR que no es dueño no la ve', async () => {
    await renderScreen(ADMINISTRATOR | VIEW_CHANNEL, 'owner');

    expect(transferButtons()).toHaveLength(0);
    expect(ownershipSource.getServerTransfer).not.toHaveBeenCalled();
  });

  it('con una pendiente se ve el aviso y la acción queda deshabilitada', async () => {
    jest.mocked(ownershipSource.getServerTransfer).mockResolvedValue(PENDING_TO_MILTON);

    await renderScreen(VIEW_CHANNEL, ME);

    expect(await screen.findByText('Transferencia pendiente a Milton')).toBeOnTheScreen();
    await waitFor(() => expect(transferButtons()[0]).toBeDisabled());
  });

  it('al dueño también se le ofrece abandonar', async () => {
    await renderScreen(VIEW_CHANNEL, ME);

    expect(screen.getByText('Abandonar servidor')).toBeOnTheScreen();
  });
});
