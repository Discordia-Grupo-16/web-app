import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { useServerDetails } from './useServerDetails';

const mockSetOptions = jest.fn();
// The same objects on every render, as expo-router gives them: the hook depends on them.
const mockNavigation = { setOptions: mockSetOptions };
const mockRouter = { back: jest.fn() };
let mockRefresh: () => void = () => undefined;

jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
}));
jest.mock('@/shared/api', () => ({ serversService: { getServer: jest.fn() } }));
// The notice and the polling are useLiveRefresh's: here the refresh is called by hand.
jest.mock('@/shared/hooks/useLiveRefresh', () => ({
  useLiveRefresh: ({ refresh }: { refresh: () => void }) => {
    mockRefresh = refresh;
  },
}));

const server: Server = {
  id: 'srv',
  name: 'Discordia',
  description: null,
  owner_id: 'ana',
  avatar_url: null,
  created_at: '2026-10-01T00:00:00Z',
  my_permissions: 1,
  my_permission_names: ['VIEW_CHANNEL'],
  channels: [],
};

// A probe instead of renderHook, like the rest of the mobile hook tests.
function Probe() {
  const { server: loaded } = useServerDetails('srv');
  return (
    <>
      <Text>{loaded ? `${loaded.name}|${loaded.owner_id}` : 'cargando'}</Text>
      <Pressable accessibilityLabel="refrescar" onPress={() => mockRefresh()}>
        <Text>refrescar</Text>
      </Pressable>
    </>
  );
}

describe('useServerDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('picks up a new owner and a new name, and retitles the screen', async () => {
    jest.mocked(serversService.getServer).mockResolvedValue(server);
    const user = userEvent.setup();
    await render(<Probe />);
    await waitFor(() => expect(screen.getByText('Discordia|ana')).toBeOnTheScreen());
    jest.mocked(serversService.getServer).mockResolvedValue({ ...server, name: 'Grupo 16', owner_id: 'beto' });

    await user.press(screen.getByLabelText('refrescar'));

    await waitFor(() => expect(screen.getByText('Grupo 16|beto')).toBeOnTheScreen());
    expect(mockSetOptions).toHaveBeenLastCalledWith({ title: 'Grupo 16' });
  });
});
