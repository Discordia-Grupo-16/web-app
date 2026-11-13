import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
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
  useAuth: () => ({ signIn: mockSignIn, pendingMfa: mockPendingMfa, beginMfa: mockBeginMfa }),
}));
jest.mock('@/shared/api', () => ({ authService: { login: (...args: unknown[]) => mockLogin(...args) } }));

const mockSignIn = jest.fn();
const mockBeginMfa = jest.fn();
const mockLogin = jest.fn();
let mockPendingMfa = false;

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

  it('hands the mfaToken to the auth provider when the account asks for a second factor', async () => {
    mockLogin.mockResolvedValue({ mfaRequired: true, mfaToken: 'mfa-token' });
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), 'ana@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password1!');
    await fireEvent.press(screen.getByText('Iniciar Sesión'));

    await waitFor(() => expect(mockBeginMfa).toHaveBeenCalledWith('mfa-token'));
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows the second step instead of the form while the verification is pending', async () => {
    mockPendingMfa = true;
    await render(<LoginScreen />);

    expect(screen.getByText('Verificación en dos pasos')).toBeTruthy();
    expect(screen.queryByText('Iniciar Sesión')).toBeNull();
    mockPendingMfa = false;
  });

  it('shows no alert when there is no notice', async () => {
    await render(<LoginScreen />);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
