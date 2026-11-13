import { act, render, screen, within } from '@testing-library/react-native';
import { AppState, Text as MockText, View as MockView } from 'react-native';
import type { Channel, Server, VoiceParticipantsUpdatedFrame } from '@discordia/api';
import {
  NONE,
  NOTICE_COALESCE_MS,
  NOTICE_MAX_JITTER_MS,
  RealtimeContext,
  VIEW_CHANNEL,
  VOICE_TEXTS,
  VoiceSpeakersContext,
  useServerVoiceRoster,
  useVoice,
  type RealtimeContextValue,
  type VoiceContextValue,
} from '@discordia/core';
import { voiceService } from '@/shared/api';
import { useServerDetails } from '@/features/servers';
import ServerScreen from '@/app/(app)/server/[serverId]';

let mockParams: Record<string, string> = {};

// Stable, like the real one: the screen lists it as an effect dependency.
const mockRouter = { back: jest.fn() };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
  // useLiveRefresh follows the focus with it; this screen is never unfocused here.
  useFocusEffect: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/shared/api', () => ({ voiceService: { getServerVoiceParticipants: jest.fn() }, ownershipSource: {} }));
jest.mock('@/features/channels', () => ({
  // Each channel in a box of its own, with whatever the screen draws below it.
  ChannelSection: ({
    channels,
    renderBelowChannel,
  }: {
    channels: Channel[];
    renderBelowChannel?: (channel: Channel) => React.ReactNode;
  }) =>
    channels.map((channel) => (
      <MockView key={channel.id} testID={`channel-${channel.id}`}>
        <MockText>{channel.name}</MockText>
        {renderBelowChannel?.(channel)}
      </MockView>
    )),
}));
jest.mock('@/features/invitations', () => ({ InvitationsSection: () => null }));
jest.mock('@/features/members', () => ({
  MembersSection: () => null,
  BansSection: () => null,
  useMembers: () => ({ members: [], loading: false, setMemberRoles: jest.fn(), removeMember: jest.fn() }),
  useBans: () => ({ bans: [], loading: false, error: false, removeBan: jest.fn(), reload: jest.fn() }),
}));
jest.mock('@/features/roles', () => ({
  RolesSection: () => null,
  useRoles: () => ({ roles: [], loading: false, addRole: jest.fn(), updateRole: jest.fn() }),
}));
jest.mock('@/features/servers', () => ({ ServerActions: () => null, useServerDetails: jest.fn() }));
// The real list: the label and the names it draws are what these tests look at.
jest.mock('@/features/voice', () => ({
  VoiceParticipantList: jest.requireActual('@/features/voice/VoiceParticipantList').VoiceParticipantList,
  VoiceCallParticipantList: jest.requireActual('@/features/voice/VoiceCallParticipantList').VoiceCallParticipantList,
}));
jest.mock('@discordia/core', () => {
  const actual = jest.requireActual('@discordia/core');
  return {
    ...actual,
    useAuth: () => ({ user: { id: 'me', name: 'Milton' } }),
    useVoice: jest.fn(),
    // The ownership transfer of the screen has its own tests (serverScreen.test.tsx).
    useOutgoingOwnershipTransfer: () => ({ view: { kind: 'none' }, busy: null, error: null, reload: jest.fn() }),
    useVoiceCallParticipants: (participants: { userId: string }[]) =>
      participants.map((p) => ({ userId: p.userId, name: `Nombre ${p.userId}`, loading: false, muted: false })),
    // The real hook, spied: it is the one that decides when to ask. Its names have tests in core.
    useServerVoiceRoster: jest.fn(actual.useServerVoiceRoster),
    useVoiceRosterViews: (roster: Map<string, { userId: string }[]>) =>
      new Map(
        [...roster].map(([channelId, people]) => [
          channelId,
          people.map((p) => ({ userId: p.userId, name: `Roster ${p.userId}`, loading: false })),
        ]),
      ),
  };
});

const channel = (id: string, name: string, type: Channel['type'] = 'voice'): Channel => ({
  id,
  server_id: 'srv',
  name,
  type,
  topic: null,
  category_id: null,
  position: 0,
  created_at: '2026-10-01T00:00:00Z',
});

const server = (myPermissions: number): Server =>
  ({
    id: 'srv',
    name: 'Discordia',
    owner_id: 'other',
    my_permissions: myPermissions,
    channels: [channel('c1', 'general', 'text'), channel('v1', 'lobby'), channel('v2', 'juegos')],
  }) as Server;

const joinedAt = '2026-11-05T10:00:00Z';

const room = (channelId: string, ids: string[], syncedAt = '2026-11-05T10:00:05Z') => ({
  channelId,
  participants: ids.map((userId) => ({ userId, joinedAt })),
  syncedAt,
});

const inCallAt = (channelId: string): Partial<VoiceContextValue> => ({
  call: {
    status: 'connected',
    channel: { id: channelId, serverId: 'srv', name: 'lobby' },
    micAvailable: true,
    micBlocked: false,
    muted: false,
    micPending: false,
    reconnecting: false,
    participants: [{ userId: 'ana', isLocal: false, muted: false, joinedAt: 1, seenOrder: 0 }],
  },
});

// A realtime context with only what the roster reads, and a way to fire a reconnection and a frame.
const createFakeRealtime = () => {
  const reconnectHandlers = new Set<() => void>();
  const frameHandlers = new Set<(frame: VoiceParticipantsUpdatedFrame) => void>();
  const value = {
    onVoiceParticipants: (handler: (frame: VoiceParticipantsUpdatedFrame) => void) => {
      frameHandlers.add(handler);
      return () => frameHandlers.delete(handler);
    },
    onReconnect: (handler: () => void) => {
      reconnectHandlers.add(handler);
      return () => reconnectHandlers.delete(handler);
    },
  } as unknown as RealtimeContextValue;
  return {
    value,
    reconnect: () => act(async () => reconnectHandlers.forEach((handler) => handler())),
    frame: (frame: VoiceParticipantsUpdatedFrame) => act(async () => frameHandlers.forEach((handler) => handler(frame))),
  };
};

const getSnapshot = jest.mocked(voiceService.getServerVoiceParticipants);

describe('la pantalla del servidor: participantes de los canales de voz (SCRUM-54)', () => {
  let realtime: ReturnType<typeof createFakeRealtime>;

  const renderScreen = async (
    voice: Partial<VoiceContextValue> = {},
    rooms: ReturnType<typeof room>[] = [],
    myPermissions = VIEW_CHANNEL,
    speaking: string[] = [],
  ) => {
    jest.mocked(useVoice).mockReturnValue({ call: { status: 'idle' }, ...voice } as VoiceContextValue);
    jest.mocked(useServerDetails).mockReturnValue({
      server: server(myPermissions),
      loading: false,
      updateChannels: jest.fn(),
      setLeaving: jest.fn(),
    } as unknown as ReturnType<typeof useServerDetails>);
    getSnapshot.mockResolvedValue(rooms);
    await render(
      <RealtimeContext.Provider value={realtime.value}>
        <VoiceSpeakersContext.Provider value={new Set(speaking)}>
          <ServerScreen />
        </VoiceSpeakersContext.Provider>
      </RealtimeContext.Provider>,
    );
    // Lets the snapshot land.
    await act(async () => {});
  };

  const below = (channelId: string) => within(screen.getByTestId(`channel-${channelId}`));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockParams = { serverId: 'srv' };
    realtime = createFakeRealtime();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lista quién está conectado debajo de un canal en el que no estoy, y nada debajo de uno vacío', async () => {
    await renderScreen({}, [room('v1', ['ana', 'beto'])]);

    expect(below('v1').getByText('Roster ana')).toBeTruthy();
    expect(below('v1').getByText('Roster beto')).toBeTruthy();
    expect(below('v2').queryByLabelText('Participantes del canal')).toBeNull();
    expect(screen.getAllByLabelText('Participantes del canal')).toHaveLength(1);
  });

  it('lista cada canal con gente debajo de su propio nombre', async () => {
    await renderScreen({}, [room('v1', ['ana']), room('v2', ['beto'])]);

    expect(below('v1').getByText('Roster ana')).toBeTruthy();
    expect(below('v2').getByText('Roster beto')).toBeTruthy();
    expect(below('v1').queryByText('Roster beto')).toBeNull();
  });

  it('en mi canal muestra la lista de la llamada y no el roster (W14)', async () => {
    // El roster también me tiene en v1, un momento tarde: ahí no se dibuja.
    await renderScreen(inCallAt('v1'), [room('v1', ['ana', 'me']), room('v2', ['beto'])]);

    expect(below('v1').getByText('Nombre ana')).toBeTruthy();
    expect(screen.queryByText('Roster ana')).toBeNull();
    expect(screen.queryByText('Roster me')).toBeNull();
    expect(below('v2').getByText('Roster beto')).toBeTruthy();
  });

  it('resalta a quien habla debajo de mi canal (SCRUM-56)', async () => {
    await renderScreen(inCallAt('v1'), [], VIEW_CHANNEL, ['ana']);

    expect(below('v1').getByTestId('voice-speaking-ana')).toBeTruthy();
  });

  it('no resalta en el roster de otro canal al mismo usuario que habla en mi llamada (SCRUM-56)', async () => {
    await renderScreen(inCallAt('v1'), [room('v2', ['ana'])], VIEW_CHANNEL, ['ana']);

    expect(below('v2').getByText('Roster ana')).toBeTruthy();
    expect(below('v2').queryByTestId('voice-speaking-ana')).toBeNull();
    expect(below('v1').getByTestId('voice-speaking-ana')).toBeTruthy();
  });

  it('muestra el indicador de silencio local, sin botón, debajo de mi canal (SCRUM-57)', async () => {
    await renderScreen({ ...inCallAt('v1'), locallyMuted: new Set(['ana']), toggleLocalMute: jest.fn() });

    expect(below('v1').getByLabelText(VOICE_TEXTS.locallyMuted)).toBeTruthy();
    expect(below('v1').queryByTestId('voice-local-mute-ana')).toBeNull();
  });

  it('no muestra silencio local en el roster de otro canal, aunque sea el mismo usuario (SCRUM-57)', async () => {
    await renderScreen(
      { ...inCallAt('v1'), locallyMuted: new Set(['ana']), toggleLocalMute: jest.fn() },
      [room('v2', ['ana'])],
    );

    expect(below('v2').getByText('Roster ana')).toBeTruthy();
    expect(below('v2').queryByLabelText(VOICE_TEXTS.locallyMuted)).toBeNull();
  });

  it('pide el roster del servidor abierto', async () => {
    await renderScreen();

    expect(useServerVoiceRoster).toHaveBeenLastCalledWith('srv', voiceService.getServerVoiceParticipants);
    expect(getSnapshot).toHaveBeenCalledWith('srv');
  });

  it('sin VIEW_CHANNEL el hook recibe undefined y no se pide nada', async () => {
    await renderScreen({}, [], NONE);

    expect(useServerVoiceRoster).toHaveBeenLastCalledWith(undefined, voiceService.getServerVoiceParticipants);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('sin el servidor cargado el hook recibe undefined y no se pide nada', async () => {
    jest.mocked(useVoice).mockReturnValue({ call: { status: 'idle' } } as VoiceContextValue);
    jest.mocked(useServerDetails).mockReturnValue({
      server: undefined,
      loading: true,
      updateChannels: jest.fn(),
      setLeaving: jest.fn(),
    } as unknown as ReturnType<typeof useServerDetails>);

    await render(
      <RealtimeContext.Provider value={realtime.value}>
        <ServerScreen />
      </RealtimeContext.Provider>,
    );

    expect(useServerVoiceRoster).toHaveBeenLastCalledWith(undefined, voiceService.getServerVoiceParticipants);
    expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('al volver la app a primer plano (el socket se reabre) relee el roster y refleja lo que cambió', async () => {
    await renderScreen({}, [room('v1', ['ana', 'beto'])]);
    expect(below('v1').getByText('Roster beto')).toBeTruthy();
    getSnapshot.mockClear();

    // Mientras la app estaba en segundo plano Beto salió y entró Carla en otro canal.
    getSnapshot.mockResolvedValue([room('v1', ['ana'], '2026-11-05T10:00:09Z'), room('v2', ['carla'], '2026-11-05T10:00:09Z')]);
    await realtime.reconnect();
    // Con el mismo retraso aleatorio que useServerEvents: no sale en el acto, y sale antes del tope.
    expect(getSnapshot).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(NOTICE_COALESCE_MS + NOTICE_MAX_JITTER_MS);
    });

    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(below('v1').queryByText('Roster beto')).toBeNull();
    expect(below('v2').getByText('Roster carla')).toBeTruthy();
  });

  it('no arma un listener de AppState propio: la vuelta a primer plano ya entra por la reconexión', async () => {
    const addListener = jest.spyOn(AppState, 'addEventListener');

    await renderScreen();

    expect(addListener).not.toHaveBeenCalled();
    addListener.mockRestore();
  });

  it('aplica un frame nuevo del servidor abierto', async () => {
    await renderScreen({}, [room('v1', ['ana'])]);

    await realtime.frame({
      type: 'voice-participants.updated',
      serverId: 'srv',
      channelId: 'v2',
      participants: [{ userId: 'beto', joinedAt }],
      syncedAt: '2026-11-05T10:00:07Z',
    });

    expect(below('v2').getByText('Roster beto')).toBeTruthy();
  });
});
