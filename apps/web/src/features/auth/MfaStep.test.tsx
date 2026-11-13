import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MfaStep, RecoveryNotice } from './MfaStep';

const completeMfa = vi.fn();
const cancelMfa = vi.fn();

vi.mock('@discordia/core', () => ({
    useAuth: () => ({ completeMfa, cancelMfa }),
}));

const wrongCode = () => Object.assign(new Error('bad'), { response: { status: 400 } });

const type = async (text: string) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Código de verificación'), text);
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    return user;
};

describe('MfaStep', () => {
    beforeEach(() => vi.clearAllMocks());

    it('sends the 6-digit code and reports success', async () => {
        completeMfa.mockResolvedValue({});
        const onVerified = vi.fn();
        render(<MfaStep onVerified={onVerified} />);

        await type('123456');

        expect(completeMfa).toHaveBeenCalledWith({ code: '123456' });
        expect(onVerified).toHaveBeenCalledWith(undefined);
    });

    it('does not call the API with an incomplete code', async () => {
        render(<MfaStep onVerified={vi.fn()} />);

        await type('123');

        expect(await screen.findByText('El código tiene 6 dígitos.')).toBeInTheDocument();
        expect(completeMfa).not.toHaveBeenCalled();
    });

    it('shows "El código no es válido" on a wrong code and lets the user retry', async () => {
        completeMfa.mockRejectedValue(wrongCode());
        render(<MfaStep onVerified={vi.fn()} />);

        await type('000000');

        expect(await screen.findByText('El código no es válido')).toBeInTheDocument();
        expect(cancelMfa).not.toHaveBeenCalled();
    });

    it('goes back to the login at the fifth wrong code', async () => {
        completeMfa.mockRejectedValue(wrongCode());
        render(<MfaStep onVerified={vi.fn()} />);
        const user = userEvent.setup();

        for (let i = 0; i < 5; i++) {
            await user.type(screen.getByLabelText('Código de verificación'), '000000');
            await user.click(screen.getByRole('button', { name: 'Verificar' }));
            await screen.findByRole('button', { name: 'Verificar' });
        }

        expect(completeMfa).toHaveBeenCalledTimes(5);
        expect(cancelMfa).toHaveBeenCalledOnce();
    });

    it('accepts a recovery code and passes the codes left to the caller', async () => {
        completeMfa.mockResolvedValue({ recoveryCodesRemaining: 4 });
        const onVerified = vi.fn();
        render(<MfaStep onVerified={onVerified} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Usar un código de recuperación' }));
        await user.type(screen.getByLabelText('Código de recuperación'), 'abcd-2345');
        await user.click(screen.getByRole('button', { name: 'Verificar' }));

        expect(completeMfa).toHaveBeenCalledWith({ recoveryCode: 'abcd-2345' });
        expect(onVerified).toHaveBeenCalledWith(4);
    });

    it('goes back to the login on request', async () => {
        render(<MfaStep onVerified={vi.fn()} />);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Volver al inicio de sesión' }));

        expect(cancelMfa).toHaveBeenCalledOnce();
    });
});

describe('RecoveryNotice', () => {
    it('tells how many codes are left and recommends generating new ones', async () => {
        const onContinue = vi.fn();
        render(<RecoveryNotice remaining={3} onContinue={onContinue} />);

        expect(screen.getByRole('status')).toHaveTextContent('Te quedan 3 códigos. Te recomendamos generar nuevos');
        await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar' }));
        expect(onContinue).toHaveBeenCalledOnce();
    });
});
