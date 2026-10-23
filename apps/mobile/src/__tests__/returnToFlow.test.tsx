import { Text } from 'react-native';
import { Slot, router } from 'expo-router';
import { act, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '@discordia/core';
import { createSessionExpirySignal, type AuthStorageStrategy } from '@discordia/api';
import { authService, invitationsService } from '@/shared/api';
import AppLayout from '@/app/(app)/_layout';
import { LoginScreen, RegisterScreen } from '@/features/auth';
import { InviteScreen } from '@/features/invitations';

jest.mock('@/shared/api', () => ({
  authService: { login: jest.fn(), register: jest.fn() },
  invitationsService: { joinServer: jest.fn() },
}));
jest.mock('@/features/chat', () => ({
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/features/profile', () => ({ ProfileButton: () => null }));
jest.mock('@/features/voice', () => ({
  VoiceProvider: ({ children }: { children: React.ReactNode }) => children,
  VoiceBar: () => null,
}));

const felipe = { id: '1', name: 'Felipe' };
const credentials = { email: 'felipe@example.com', password: 'Password1' };

const memoryStorage = (open: boolean): AuthStorageStrategy => {
  let token: string | null = open ? 'access' : null;
  let user: unknown = open ? felipe : null;
  return {
    getToken: async () => token,
    setToken: async (value) => { token = value; },
    getUser: async <T,>() => user as T | null,
    setUser: async (value) => { user = value; },
    clearSession: async () => { token = null; user = null; },
  };
};

const SignOutButton = () => {
  const { signOut } = useAuth();
  return <Text onPress={() => void signOut()}>Cerrar sesión</Text>;
};

const renderApp = async (initialUrl: string, { sessionOpen = false } = {}) => {
  const sessionExpiry = createSessionExpirySignal();
  const storage = memoryStorage(sessionOpen);
  const Root = () => (
    <AuthProvider storage={storage} onSignOut={async () => undefined} sessionExpiry={sessionExpiry}>
      <Slot />
    </AuthProvider>
  );
  const view = renderRouter(
    {
      _layout: Root,
      '(auth)/login': LoginScreen,
      '(auth)/register': RegisterScreen,
      '(app)/_layout': AppLayout,
      '(app)/index': () => (
        <>
          <Text>Inicio</Text>
          <SignOutButton />
        </>
      ),
      '(app)/invite/[code]': InviteScreen,
      '(app)/join': () => null,
      '(app)/server/[serverId]/index': () => <Text>Servidor</Text>,
      '(app)/server/[serverId]/channel/[channelId]': () => null,
    },
    { initialUrl },
  );
  // RNTL 14 renders asynchronously; the router helpers live on the object renderRouter returns.
  await view;
  return {
    sessionExpiry,
    pathname: () => view.getPathname(),
    params: () => view.getSearchParams(),
  };
};

const fillCredentials = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText('tu@correo.com'), credentials.email);
  await user.type(screen.getByPlaceholderText('••••••••'), credentials.password);
};

describe('return to the pending destination after authenticating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authService.login).mockResolvedValue({ token: 'access', refreshToken: 'refresh', user: felipe } as never);
    // The invitation never answers, so the flow stays on the invite screen to check where it lands.
    jest.mocked(invitationsService.joinServer).mockReturnValue(new Promise(() => undefined));
  });

  it('sends an invitation opened without a session through the login and back to it', async () => {
    const user = userEvent.setup();
    const app = await renderApp('/invite/abc123');

    await waitFor(() => expect(screen.getByText('Iniciar Sesión')).toBeOnTheScreen());
    expect(app.pathname()).toBe('/login');
    expect(app.params()).toEqual({ returnTo: '/invite/abc123' });

    await fillCredentials(user);
    await user.press(screen.getByText('Iniciar Sesión'));

    await waitFor(() => expect(app.pathname()).toBe('/invite/abc123'));
    // Back from the login, the link joins on its own.
    await waitFor(() => expect(invitationsService.joinServer).toHaveBeenCalledWith('abc123'));
    expect(screen.getByText('Procesando invitación…')).toBeOnTheScreen();
  });

  it('keeps the destination when the user goes from the login to the register screen', async () => {
    jest.mocked(authService.register).mockResolvedValue({ token: 'access', user: felipe } as never);
    const user = userEvent.setup();
    const app = await renderApp('/invite/abc123');

    await waitFor(() => expect(screen.getByText('Regístrate')).toBeOnTheScreen());
    await user.press(screen.getByText('Regístrate'));
    await waitFor(() => expect(app.pathname()).toBe('/register'));
    expect(app.params()).toEqual({ returnTo: '/invite/abc123' });

    await user.type(screen.getByPlaceholderText('ej. Jane Doe'), 'Felipe');
    await user.type(screen.getByPlaceholderText('tu@correo.com'), credentials.email);
    await user.type(screen.getByPlaceholderText('••••••••'), credentials.password);
    await user.press(screen.getByText('Continuar'));

    await waitFor(() => expect(app.pathname()).toBe('/invite/abc123'));
  });

  it('goes to the home when nothing was pending', async () => {
    const user = userEvent.setup();
    const app = await renderApp('/');

    await waitFor(() => expect(screen.getByText('Iniciar Sesión')).toBeOnTheScreen());
    expect(app.params()).toEqual({});

    await fillCredentials(user);
    await user.press(screen.getByText('Iniciar Sesión'));

    await waitFor(() => expect(screen.getByText('Inicio')).toBeOnTheScreen());
  });

  it.each(['//evil.com', 'https://evil.com'])('ignores the external destination %s', async (returnTo) => {
    const user = userEvent.setup();
    await renderApp(`/login?returnTo=${encodeURIComponent(returnTo)}`);

    await waitFor(() => expect(screen.getByText('Iniciar Sesión')).toBeOnTheScreen());
    await fillCredentials(user);
    await user.press(screen.getByText('Iniciar Sesión'));

    await waitFor(() => expect(screen.getByText('Inicio')).toBeOnTheScreen());
  });

  it('returns to the screen the user was on when the session expires', async () => {
    const user = userEvent.setup();
    const app = await renderApp('/server/42', { sessionOpen: true });

    await waitFor(() => expect(screen.getByText('Servidor')).toBeOnTheScreen());
    await act(async () => app.sessionExpiry.notify());

    await waitFor(() => expect(screen.getByText('Iniciar Sesión')).toBeOnTheScreen());
    expect(app.params()).toEqual({ returnTo: '/server/42' });

    await fillCredentials(user);
    await user.press(screen.getByText('Iniciar Sesión'));

    await waitFor(() => expect(app.pathname()).toBe('/server/42'));
    expect(screen.getByText('Servidor')).toBeOnTheScreen();
  });

  it('does not leave a pending destination when the user closes the session on purpose', async () => {
    const user = userEvent.setup();
    const app = await renderApp('/', { sessionOpen: true });

    await waitFor(() => expect(screen.getByText('Cerrar sesión')).toBeOnTheScreen());
    await user.press(screen.getByText('Cerrar sesión'));

    await waitFor(() => expect(screen.getByText('Iniciar Sesión')).toBeOnTheScreen());
    expect(app.params()).toEqual({});
  });

  it('keeps the invitation of a link opened after the user closed the session on purpose', async () => {
    const user = userEvent.setup();
    const app = await renderApp('/', { sessionOpen: true });

    await waitFor(() => expect(screen.getByText('Cerrar sesión')).toBeOnTheScreen());
    await user.press(screen.getByText('Cerrar sesión'));
    await waitFor(() => expect(screen.getByText('Iniciar Sesión')).toBeOnTheScreen());

    // The app is still in memory when the link arrives.
    await act(async () => router.push('/invite/abc123'));

    await waitFor(() => expect(app.params()).toEqual({ returnTo: '/invite/abc123' }));
    await fillCredentials(user);
    await user.press(screen.getByText('Iniciar Sesión'));

    await waitFor(() => expect(app.pathname()).toBe('/invite/abc123'));
  });
});
