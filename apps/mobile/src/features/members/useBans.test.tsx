import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { ServerBan } from '@discordia/api';
import { membersService } from '@/shared/api';
import { useBans } from './useBans';

jest.mock('@/shared/api', () => ({ membersService: { listBans: jest.fn() } }));
// `useFocusedPolling` usa useFocusEffect, que pide un contenedor de navegación
// que esta sonda no tiene. El poll usa el mismo `reload` que se prueba acá.
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));

const ban = (userId: string): ServerBan => ({
  user_id: userId,
  banned_by: 'mod',
  reason: null,
  created_at: '2026-10-01T00:00:00Z',
});

// Sonda, por lo mismo que en useMembers.test.tsx.
function Probe({
  serverId = 'srv',
  enabled,
  action = () => undefined,
}: {
  serverId?: string;
  enabled: boolean;
  action?: (api: ReturnType<typeof useBans>) => void;
}) {
  const api = useBans(serverId, enabled);
  return (
    <>
      <Text>{`baneos:${api.bans.map(b => b.user_id).join(',')}`}</Text>
      <Pressable accessibilityLabel="disparar" onPress={() => action(api)}>
        <Text>disparar</Text>
      </Pressable>
    </>
  );
}

describe('useBans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sin BAN_MEMBERS no le pide nada al backend', async () => {
    // El GET daría 403: pedirlo igual sería un error en la consola en cada poll.
    await render(<Probe enabled={false} />);

    expect(screen.getByText('baneos:')).toBeOnTheScreen();
    expect(membersService.listBans).not.toHaveBeenCalled();
  });

  it('con BAN_MEMBERS carga los baneos del servidor', async () => {
    jest.mocked(membersService.listBans).mockResolvedValue([ban('u1')]);

    await render(<Probe enabled />);

    expect(await screen.findByText('baneos:u1')).toBeOnTheScreen();
    expect(membersService.listBans).toHaveBeenCalledWith('srv');
  });

  it('carga cuando el permiso llega después', async () => {
    // Es el caso real: la pantalla arranca sin permisos hasta que carga el servidor.
    jest.mocked(membersService.listBans).mockResolvedValue([ban('u1')]);
    await render(<Probe enabled={false} />);

    await screen.rerender(<Probe enabled />);

    expect(await screen.findByText('baneos:u1')).toBeOnTheScreen();
  });

  it('removeBan saca solo esa fila', async () => {
    jest.mocked(membersService.listBans).mockResolvedValue([ban('u1'), ban('u2')]);
    const user = userEvent.setup();
    await render(<Probe enabled action={api => api.removeBan('u1')} />);
    await screen.findByText('baneos:u1,u2');

    await user.press(screen.getByLabelText('disparar'));

    expect(screen.getByText('baneos:u2')).toBeOnTheScreen();
  });

  it('reload trae al recién baneado sin esperar al poll', async () => {
    jest.mocked(membersService.listBans).mockResolvedValue([]);
    const user = userEvent.setup();
    await render(<Probe enabled action={api => api.reload()} />);
    await waitFor(() => expect(membersService.listBans).toHaveBeenCalledTimes(1));
    jest.mocked(membersService.listBans).mockResolvedValue([ban('u1')]);

    await user.press(screen.getByLabelText('disparar'));

    expect(await screen.findByText('baneos:u1')).toBeOnTheScreen();
  });

  it('descarta la respuesta tardía de un reload del servidor anterior', async () => {
    // El poll usa el mismo reload: si al cambiar de servidor queda uno en vuelo, su
    // respuesta no puede pisar la lista del servidor nuevo con baneos del viejo.
    jest.mocked(membersService.listBans).mockResolvedValueOnce([]);
    const user = userEvent.setup();
    const reload = (api: ReturnType<typeof useBans>) => api.reload();
    await render(<Probe serverId="srv-a" enabled action={reload} />);
    await waitFor(() => expect(membersService.listBans).toHaveBeenCalledTimes(1));

    let answerOld!: (bans: ServerBan[]) => void;
    jest.mocked(membersService.listBans).mockImplementationOnce(
      () => new Promise(resolve => (answerOld = resolve)),
    );
    await user.press(screen.getByLabelText('disparar'));
    jest.mocked(membersService.listBans).mockResolvedValueOnce([ban('de-b')]);
    await screen.rerender(<Probe serverId="srv-b" enabled action={reload} />);
    await screen.findByText('baneos:de-b');

    await act(async () => answerOld([ban('de-a')]));

    expect(screen.getByText('baneos:de-b')).toBeOnTheScreen();
  });
});
