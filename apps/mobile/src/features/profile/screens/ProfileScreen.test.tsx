import { render, screen, userEvent } from '@testing-library/react-native';
import type { User } from '@discordia/api';
import { ProfileScreen } from './ProfileScreen';

const mockPush = jest.fn();
const mockSignOut = jest.fn();

let mockUser: User | null = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: () => null },
}));

jest.mock('@discordia/core', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
  }),
}));

const baseUser: User = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Milton',
  role: 'user',
  avatarUrl: null,
  bio: 'Esta es mi biografía',
  createdAt: '2026-03-10T00:00:00Z',
};

const renderScreen = async (user: User | null = baseUser) => {
  mockUser = user;
  const actor = userEvent.setup();
  await render(<ProfileScreen />);
  return { user: actor };
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('no muestra nada si no hay usuario autenticado', async () => {
    await renderScreen(null);
    expect(screen.queryByText('Editar perfil')).not.toBeOnTheScreen();
  });

  it('muestra la información del perfil del usuario', async () => {
    await renderScreen();

    expect(screen.getByText('Milton')).toBeOnTheScreen();
    expect(screen.getByText('M')).toBeOnTheScreen();
    expect(screen.getByText('Sobre mí')).toBeOnTheScreen();
    expect(screen.getByText('Esta es mi biografía')).toBeOnTheScreen();
    expect(screen.getByText('Miembro desde')).toBeOnTheScreen();
  });

  it('navega a la pantalla de edición al presionar "Editar perfil"', async () => {
    const { user } = await renderScreen();

    await user.press(screen.getByText('Editar perfil'));

    expect(mockPush).toHaveBeenCalledWith('/edit-profile');
  });

  it('ejecuta signOut al presionar "Cerrar sesión"', async () => {
    const { user } = await renderScreen();

    await user.press(screen.getByText('Cerrar sesión'));

    expect(mockSignOut).toHaveBeenCalled();
  });
});
