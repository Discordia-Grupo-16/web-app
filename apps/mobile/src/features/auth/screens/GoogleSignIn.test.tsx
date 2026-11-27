import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { GoogleSignIn } from './GoogleSignIn';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

const mockSignIn = jest.fn();
const mockBeginMfa = jest.fn();
jest.mock('@discordia/core', () => ({
  ...jest.requireActual('@discordia/core'),
  useAuth: () => ({ signIn: mockSignIn, beginMfa: mockBeginMfa }),
}));

const mockLoginWithGoogle = jest.fn();
jest.mock('@/shared/api', () => ({
  authService: { loginWithGoogle: (...args: unknown[]) => mockLoginWithGoogle(...args) },
}));

let mockClientId = 'android-client-id';
jest.mock('@/shared/config/env', () => ({
  get GOOGLE_ANDROID_CLIENT_ID() {
    return mockClientId;
  },
}));

// The Google provider is simulated: the test decides what the prompt answers.
const mockPrompt = jest.fn();
let mockResponse: unknown = null;
jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => [{ url: 'request' }, mockResponse, mockPrompt],
}));

const session = {
  token: 'access',
  user: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
  refreshToken: 'refresh',
};

/** An error like the one axios rejects with: `getApiErrorMessage` only reads those. */
const apiError = (status: number, detail: string) =>
  Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: { detail } },
  });

const onError = jest.fn();
const onStart = jest.fn();

const renderButton = () => render(<GoogleSignIn onError={onError} onStart={onStart} />);

/** Renders the button without an answer, then re-renders it as if Google had answered. */
const renderAnswered = async (response: unknown) => {
  const view = await renderButton();
  mockResponse = response;
  await act(async () => {
    view.rerender(<GoogleSignIn onError={onError} onStart={onStart} />);
  });
  return view;
};

describe('GoogleSignIn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResponse = null;
    mockClientId = 'android-client-id';
  });

  it('renders nothing without an Android client ID, so only the email form is left', async () => {
    mockClientId = '';
    await renderButton();

    expect(screen.queryByText('Continuar con Google')).toBeNull();
    expect(screen.queryByText('o')).toBeNull();
  });

  it('reports Google as unavailable when the prompt cannot be opened', async () => {
    mockPrompt.mockRejectedValueOnce(new Error('no browser'));
    await renderButton();

    await fireEvent.press(screen.getByText('Continuar con Google'));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'No pudimos conectar con Google. Ingresá con tu correo y contraseña.',
      ),
    );
  });

  it('does not open a second prompt while the first one is on screen', async () => {
    mockPrompt.mockReturnValueOnce(new Promise(() => {}));
    await renderButton();

    await fireEvent.press(screen.getByText('Continuar con Google'));
    await fireEvent.press(screen.getByText('Continuar con Google'));

    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it('cannot be pressed while the email form is being sent', async () => {
    await render(<GoogleSignIn onError={onError} onStart={onStart} disabled />);

    await fireEvent.press(screen.getByText('Continuar con Google'));

    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('opens the Google prompt and clears the form error when pressed', async () => {
    await renderButton();

    await fireEvent.press(screen.getByText('Continuar con Google'));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it('exchanges the ID token for a session and goes to the app (CA1 and CA2)', async () => {
    mockLoginWithGoogle.mockResolvedValue(session);

    await renderAnswered({ type: 'success', params: { id_token: 'google-id-token' } });

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('access', session.user, 'refresh'),
    );
    expect(mockLoginWithGoogle).toHaveBeenCalledWith('google-id-token');
    expect(mockReplace).toHaveBeenCalled();
    expect(mockBeginMfa).not.toHaveBeenCalled();
  });

  it('hands the mfaToken to the auth provider when the account has a second factor', async () => {
    mockLoginWithGoogle.mockResolvedValue({ mfaRequired: true, mfaToken: 'mfa-token' });

    await renderAnswered({ type: 'success', params: { id_token: 'google-id-token' } });

    await waitFor(() => expect(mockBeginMfa).toHaveBeenCalledWith('mfa-token'));
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the server message when Google cannot be reached (CA3)', async () => {
    mockLoginWithGoogle.mockRejectedValue(
      apiError(503, 'No pudimos conectar con Google. Ingresá con tu correo y contraseña'),
    );

    await renderAnswered({ type: 'success', params: { id_token: 'google-id-token' } });

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'No pudimos conectar con Google. Ingresá con tu correo y contraseña',
      ),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('reports a rejected token without opening a session', async () => {
    mockLoginWithGoogle.mockRejectedValue(
      apiError(401, 'No pudimos validar tu cuenta de Google'),
    );

    await renderAnswered({ type: 'success', params: { id_token: 'bad-token' } });

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('No pudimos validar tu cuenta de Google'),
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('reports an answer without an ID token', async () => {
    await renderAnswered({ type: 'success', params: {} });

    expect(onError).toHaveBeenCalledWith('No pudimos validar tu cuenta de Google.');
    expect(mockLoginWithGoogle).not.toHaveBeenCalled();
  });

  it('reports a failed prompt as Google being unavailable', async () => {
    await renderAnswered({ type: 'error', params: {} });

    expect(onError).toHaveBeenCalledWith(
      'No pudimos conectar con Google. Ingresá con tu correo y contraseña.',
    );
    expect(mockLoginWithGoogle).not.toHaveBeenCalled();
  });

  it('stays silent when the user closes the Google sheet', async () => {
    await renderAnswered({ type: 'dismiss' });

    expect(onError).not.toHaveBeenCalled();
    expect(mockLoginWithGoogle).not.toHaveBeenCalled();
  });
});
