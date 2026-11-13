import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { authService } from '@/shared/api';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/shared/api', () => ({ authService: { requestPasswordReset: jest.fn() } }));

const requestPasswordReset = authService.requestPasswordReset as jest.Mock;

const submit = async (email: string) => {
  await fireEvent.changeText(screen.getByPlaceholderText('tu@correo.com'), email);
  await fireEvent.press(screen.getByText('Enviar link'));
};

describe('ForgotPasswordScreen', () => {
  beforeEach(() => requestPasswordReset.mockReset());

  it('sends the trimmed email and shows the same neutral message', async () => {
    requestPasswordReset.mockResolvedValue(undefined);
    await render(<ForgotPasswordScreen />);

    await submit('  ana@correo.com ');

    await waitFor(() =>
      expect(
        screen.getByText(
          'Si el correo está registrado, te llega un link para cambiar la contraseña.'
        )
      ).toBeTruthy()
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(requestPasswordReset).toHaveBeenCalledWith('ana@correo.com');
    expect(screen.getByText(/Abrí el link del correo/)).toBeTruthy();
  });

  it('does not call the API when the email is invalid', async () => {
    await render(<ForgotPasswordScreen />);

    await submit('no-es-un-correo');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'El correo electrónico no tiene un formato válido.'
    );
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows the too-many-requests message on a 429', async () => {
    requestPasswordReset.mockRejectedValue({ response: { status: 429 } });
    await render(<ForgotPasswordScreen />);

    await submit('ana@correo.com');

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Hiciste muchos pedidos. Probá de nuevo en unos minutos.'
      )
    );
  });
});
