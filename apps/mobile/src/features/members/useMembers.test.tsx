import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { Role, ServerMember } from '@discordia/api';
import { membersService } from '@/shared/api';
import { useMembers } from './useMembers';

jest.mock('@/shared/api', () => ({ membersService: { listMembers: jest.fn() } }));

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

const BAJO = role('r1', 'Novato', 1);
const ALTO = role('r2', 'Admin', 5);

// Sonda, por lo mismo que en useRoles.test.tsx.
function Probe({ action }: { action: (api: ReturnType<typeof useMembers>) => void }) {
  const api = useMembers('srv');
  return (
    <>
      <Text>
        {api.members.map(m => `${m.user_id}:${m.roles.map(r => r.name).join(',')}`).join('|')}
      </Text>
      <Pressable accessibilityLabel="disparar" onPress={() => action(api)}>
        <Text>disparar</Text>
      </Pressable>
    </>
  );
}

const mounted = async (
  members: ServerMember[],
  action: (api: ReturnType<typeof useMembers>) => void,
) => {
  jest.mocked(membersService.listMembers).mockResolvedValue(members);
  const user = userEvent.setup();
  await render(<Probe action={action} />);
  await waitFor(() => expect(screen.queryByText(/u1/)).toBeOnTheScreen());
  return user;
};

describe('useMembers setMemberRoles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ordena los roles por position, no por el orden en que llegan', async () => {
    // La lista nombra al miembro por su rol más alto, que es el último.
    // Asignar uno de menor posición y dejarlo al final lo haría aparecer como
    // el más alto.
    const user = await mounted(
      [{ user_id: 'u1', joined_at: '2026-10-01T00:00:00Z', roles: [ALTO] }],
      api => api.setMemberRoles('u1', [ALTO, BAJO]),
    );

    await user.press(screen.getByLabelText('disparar'));

    expect(screen.getByText('u1:Novato,Admin')).toBeOnTheScreen();
  });

  it('no toca a los demás miembros', async () => {
    const user = await mounted(
      [
        { user_id: 'u1', joined_at: '2026-10-01T00:00:00Z', roles: [] },
        { user_id: 'u2', joined_at: '2026-10-01T00:00:00Z', roles: [ALTO] },
      ],
      api => api.setMemberRoles('u1', [BAJO]),
    );

    await user.press(screen.getByLabelText('disparar'));

    expect(screen.getByText('u1:Novato|u2:Admin')).toBeOnTheScreen();
  });
});
