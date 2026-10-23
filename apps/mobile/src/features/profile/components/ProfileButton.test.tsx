import { render, screen, userEvent } from '@testing-library/react-native';
import type { User } from '@discordia/api';
import { ProfileButton } from './ProfileButton';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const baseUser: User = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Lucia',
  role: 'user',
  avatarUrl: null,
};

describe('ProfileButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra la inicial del nombre en mayúscula cuando no tiene avatar', async () => {
    await render(<ProfileButton user={baseUser} />);

    expect(screen.getByText('L')).toBeOnTheScreen();
  });

  it('muestra un signo de pregunta cuando no tiene nombre ni avatar', async () => {
    await render(<ProfileButton user={{ ...baseUser, name: '' }} />);

    expect(screen.getByText('?')).toBeOnTheScreen();
  });

  it('navega a la pantalla de perfil al ser presionado', async () => {
    const user = userEvent.setup();
    await render(<ProfileButton user={baseUser} />);

    await user.press(screen.getByText('L'));

    expect(mockPush).toHaveBeenCalledWith('/profile');
  });
});
