import { fireEvent, render, screen } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import { setLoginNotice } from '@/shared/session/loginNotice';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useRouter: () => ({ replace: jest.fn() }),
  // useReturnTo reads the pending destination from the route.
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useAuth: () => ({ signIn: jest.fn() }),
}));
jest.mock('@/shared/api', () => ({ authService: { login: jest.fn() } }));

const NOTICE = 'Tu cuenta fue suspendida por el equipo de Discordia.';

describe('LoginScreen', () => {
  it('shows a stored login notice with role alert, and not after remounting', async () => {
    setLoginNotice(NOTICE);

    const first = await render(<LoginScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent(NOTICE);
    await first.unmount();

    await render(<LoginScreen />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('hides the login notice as soon as the login is submitted', async () => {
    setLoginNotice(NOTICE);
    await render(<LoginScreen />);
    expect(screen.getByRole('alert')).toBeTruthy();

    await fireEvent.press(screen.getByText('Iniciar Sesión'));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows no alert when there is no notice', async () => {
    await render(<LoginScreen />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
