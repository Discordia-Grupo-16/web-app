import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SecurityModal } from './SecurityModal';

const mockSetup = jest.fn();
const mockEnable = jest.fn();
const mockRegenerate = jest.fn();
const mockDisable = jest.fn();

jest.mock('@/shared/api', () => ({
  mfaService: {
    setup: (...a: unknown[]) => mockSetup(...a),
    enable: (...a: unknown[]) => mockEnable(...a),
    regenerateRecoveryCodes: (...a: unknown[]) => mockRegenerate(...a),
    disable: (...a: unknown[]) => mockDisable(...a),
  },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');

const URI = 'otpauth://totp/Discordia:ana@example.com?secret=ABCDEF&issuer=Discordia';
const CODES = ['abcd-2345', 'efgh-6789'];

const httpError = (status: number) => Object.assign(new Error('x'), { response: { status } });

const renderModal = async (onClose = jest.fn()) => {
  await render(<SecurityModal visible onClose={onClose} />);
  return onClose;
};

const activate = async () => {
  mockSetup.mockResolvedValue({ secret: 'ABCDEF', otpauthUri: URI });
  await fireEvent.press(screen.getByText('Activar verificación en dos pasos'));
  await screen.findByText('ABCDEF');
};

describe('SecurityModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the secret and opens the otpauth URI in the authenticator app', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderModal();
    await activate();

    await fireEvent.press(screen.getByText('Abrir en la app autenticadora'));

    expect(open).toHaveBeenCalledWith(URI);
  });

  it('enables 2FA with the code and shows the recovery codes once', async () => {
    mockEnable.mockResolvedValue({ recoveryCodes: CODES });
    await renderModal();
    await activate();

    await fireEvent.changeText(screen.getByLabelText('Código de verificación'), '123456');
    await fireEvent.press(screen.getByText('Activar'));

    expect(await screen.findByText('abcd-2345')).toBeTruthy();
    expect(mockEnable).toHaveBeenCalledWith('123456');
  });

  it('does not call the API with an incomplete code', async () => {
    await renderModal();
    await activate();

    await fireEvent.changeText(screen.getByLabelText('Código de verificación'), '123');
    await fireEvent.press(screen.getByText('Activar'));

    expect(await screen.findByText('El código tiene 6 dígitos.')).toBeTruthy();
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it('shows "El código no es válido" on a wrong code', async () => {
    mockEnable.mockRejectedValue(httpError(400));
    await renderModal();
    await activate();

    await fireEvent.changeText(screen.getByLabelText('Código de verificación'), '000000');
    await fireEvent.press(screen.getByText('Activar'));

    expect(await screen.findByText('El código no es válido')).toBeTruthy();
  });

  it('copies and shares the recovery codes, and only closes with "Ya los guardé"', async () => {
    mockEnable.mockResolvedValue({ recoveryCodes: CODES });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const onClose = await renderModal();
    await activate();
    await fireEvent.changeText(screen.getByLabelText('Código de verificación'), '123456');
    await fireEvent.press(screen.getByText('Activar'));
    await screen.findByText('abcd-2345');

    await fireEvent.press(screen.getByText('Copiar'));
    await fireEvent.press(screen.getByText('Compartir'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('abcd-2345\nefgh-6789');
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByText('Volver')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Ya los guardé'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('regenerates the recovery codes with a current code', async () => {
    mockRegenerate.mockResolvedValue({ recoveryCodes: CODES });
    await renderModal();

    await fireEvent.press(screen.getByText('Generar códigos de recuperación nuevos'));
    await fireEvent.changeText(screen.getByLabelText('Código de verificación'), '654321');
    await fireEvent.press(screen.getByText('Generar códigos nuevos'));

    expect(await screen.findByText('efgh-6789')).toBeTruthy();
    expect(mockRegenerate).toHaveBeenCalledWith('654321');
  });

  it('disables 2FA with the password and reports it', async () => {
    mockDisable.mockResolvedValue(undefined);
    await renderModal();

    await fireEvent.press(screen.getByText('Desactivar'));
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'Password1!');
    await fireEvent.press(screen.getAllByText('Desactivar')[0]);

    expect(await screen.findByText('Desactivaste la verificación en dos pasos.')).toBeTruthy();
    expect(mockDisable).toHaveBeenCalledWith('Password1!');
  });

  it('says the password is wrong on a 401 when disabling', async () => {
    mockDisable.mockRejectedValue(httpError(401));
    await renderModal();

    await fireEvent.press(screen.getByText('Desactivar'));
    await fireEvent.changeText(screen.getByLabelText('Contraseña'), 'nope');
    await fireEvent.press(screen.getAllByText('Desactivar')[0]);

    expect(await screen.findByText('La contraseña es incorrecta')).toBeTruthy();
  });

  it('explains that 2FA is already active when the setup answers 409', async () => {
    mockSetup.mockRejectedValue(httpError(409));
    await renderModal();

    await fireEvent.press(screen.getByText('Activar verificación en dos pasos'));

    expect(await screen.findByText(/ya está activa/)).toBeTruthy();
  });
});
