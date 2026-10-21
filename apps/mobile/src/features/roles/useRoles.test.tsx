import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { useRoles } from './useRoles';

jest.mock('@/shared/api', () => ({ rolesService: { listRoles: jest.fn() } }));

const role = (id: string, name: string, isDefault = false): Role => ({
  id,
  server_id: 'srv',
  name,
  is_default: isDefault,
  permissions: 3,
  permission_names: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
  position: 0,
  created_at: '2026-10-01T00:00:00Z',
});

// Una sonda en vez de renderHook: este preset no configura el entorno de act()
// para ese helper, y `render` es lo que usa el resto de los tests del mobile.
// La acción se dispara desde adentro con un botón, así no hace falta sacar el
// hook del componente.
function Probe({ action }: { action: (api: ReturnType<typeof useRoles>) => void }) {
  const api = useRoles('srv');
  return (
    <>
      <Text>{api.roles.map(r => `${r.name}=${r.is_default}`).join('|')}</Text>
      <Pressable accessibilityLabel="disparar" onPress={() => action(api)}>
        <Text>disparar</Text>
      </Pressable>
    </>
  );
}

const mounted = async (roles: Role[], action: (api: ReturnType<typeof useRoles>) => void) => {
  jest.mocked(rolesService.listRoles).mockResolvedValue(roles);
  const user = userEvent.setup();
  await render(<Probe action={action} />);
  await waitFor(() => expect(screen.queryByText(/=/)).toBeOnTheScreen());
  return user;
};

describe('useRoles updateRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marcar un rol como defecto desmarca el anterior', async () => {
    // El backend lo desmarca en la misma transacción. Sin replicarlo acá, la
    // lista muestra dos insignias "Por defecto" hasta recargar.
    const user = await mounted(
      [role('r1', 'everyone', true), role('r2', 'Miembro')],
      api => api.updateRole(role('r2', 'Miembro', true)),
    );

    await user.press(screen.getByLabelText('disparar'));

    expect(screen.getByText('everyone=false|Miembro=true')).toBeOnTheScreen();
  });

  it('editar un rol que no es el defecto no toca al que lo es', async () => {
    const user = await mounted(
      [role('r1', 'everyone', true), role('r2', 'Miembro')],
      api => api.updateRole({ ...role('r2', 'Moderador'), permissions: 1 }),
    );

    await user.press(screen.getByLabelText('disparar'));

    expect(screen.getByText('everyone=true|Moderador=false')).toBeOnTheScreen();
  });
});

describe('useRoles addRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('relee la lista en vez de agregar el rol nuevo al final', async () => {
    // Crear un rol lo pone abajo de la jerarquía y empuja un lugar a los demás
    // (ADR-0001 de community), así que las posiciones que tiene el cliente
    // quedan viejas. Agregarlo al arreglo mostraría el orden mal.
    const nuevo = role('r2', 'Moderador');
    const user = await mounted([role('r1', 'everyone', true)], api => api.addRole());
    jest
      .mocked(rolesService.listRoles)
      .mockResolvedValue([role('r1', 'everyone', true), nuevo]);

    await user.press(screen.getByLabelText('disparar'));

    await waitFor(() => expect(rolesService.listRoles).toHaveBeenCalledTimes(2));
    expect(screen.getByText('everyone=true|Moderador=false')).toBeOnTheScreen();
  });
});
