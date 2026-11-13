import { fireEvent, render, screen } from '@testing-library/react-native';
import { MfaStep, RecoveryNotice } from './MfaStep';

const mockCompleteMfa = jest.fn();
const mockCancelMfa = jest.fn();

jest.mock('@discordia/core', () => ({
  useAuth: () => ({ completeMfa: mockCompleteMfa, cancelMfa: mockCancelMfa }),
}));

const wrongCode = () => Object.assign(new Error('bad'), { response: { status: 400 } });

const submit = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
  await fireEvent.press(screen.getByText('Verificar'));
};

describe('MfaStep', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the 6-digit code and reports success', async () => {
    mockCompleteMfa.mockResolvedValue({});
    const onVerified = jest.fn();
    await render(<MfaStep onVerified={onVerified} />);

    await submit('Código de verificación', '123456');

    expect(mockCompleteMfa).toHaveBeenCalledWith({ code: '123456' });
    expect(await screen.findByText('Verificación en dos pasos')).toBeTruthy();
    expect(onVerified).toHaveBeenCalledWith(undefined);
  });

  it('does not call the API with an incomplete code', async () => {
    await render(<MfaStep onVerified={jest.fn()} />);

    await submit('Código de verificación', '123');

    expect(await screen.findByText('El código tiene 6 dígitos.')).toBeTruthy();
    expect(mockCompleteMfa).not.toHaveBeenCalled();
  });

  it('shows "El código no es válido" on a wrong code and lets the user retry', async () => {
    mockCompleteMfa.mockRejectedValue(wrongCode());
    await render(<MfaStep onVerified={jest.fn()} />);

    await submit('Código de verificación', '000000');

    expect(await screen.findByText('El código no es válido')).toBeTruthy();
    expect(mockCancelMfa).not.toHaveBeenCalled();
  });

  it('goes back to the login at the fifth wrong code', async () => {
    mockCompleteMfa.mockRejectedValue(wrongCode());
    await render(<MfaStep onVerified={jest.fn()} />);

    for (let i = 0; i < 5; i++) {
      await submit('Código de verificación', '000000');
      await screen.findByText('Verificar');
    }

    expect(mockCompleteMfa).toHaveBeenCalledTimes(5);
    expect(mockCancelMfa).toHaveBeenCalledTimes(1);
  });

  it('accepts a recovery code and passes the codes left to the caller', async () => {
    mockCompleteMfa.mockResolvedValue({ recoveryCodesRemaining: 4 });
    const onVerified = jest.fn();
    await render(<MfaStep onVerified={onVerified} />);

    await fireEvent.press(screen.getByText('Usar un código de recuperación'));
    await submit('Código de recuperación', 'abcd-2345');

    expect(mockCompleteMfa).toHaveBeenCalledWith({ recoveryCode: 'abcd-2345' });
    expect(onVerified).toHaveBeenCalledWith(4);
  });

  it('goes back to the login on request', async () => {
    await render(<MfaStep onVerified={jest.fn()} />);

    await fireEvent.press(screen.getByText('Volver al inicio de sesión'));

    expect(mockCancelMfa).toHaveBeenCalledTimes(1);
  });
});

describe('RecoveryNotice', () => {
  it('tells how many codes are left and recommends generating new ones', async () => {
    const onContinue = jest.fn();
    await render(<RecoveryNotice remaining={3} onContinue={onContinue} />);

    expect(screen.getByText(/Te quedan 3 códigos. Te recomendamos generar nuevos/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Continuar'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
