import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SecurityModal } from './SecurityModal';
import { mfaService } from '@/shared/api';

vi.mock('@/shared/api', () => ({
    mfaService: { setup: vi.fn(), enable: vi.fn(), regenerateRecoveryCodes: vi.fn(), disable: vi.fn() },
}));

const mfa = vi.mocked(mfaService);
const codes = Array.from({ length: 10 }, (_, i) => `code-${String(i).padStart(4, '0')}`);
const httpError = (status: number) => Object.assign(new Error('x'), { response: { status } });

describe('SecurityModal', () => {
    beforeEach(() => vi.clearAllMocks());

    it('walks through the activation: QR and secret, code, then the recovery codes', async () => {
        mfa.setup.mockResolvedValue({ secret: 'JBSWY3DP', otpauthUri: 'otpauth://totp/Discordia:a?secret=JBSWY3DP' });
        mfa.enable.mockResolvedValue({ recoveryCodes: codes });
        const onClose = vi.fn();
        render(<SecurityModal onClose={onClose} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }));
        expect(await screen.findByText('JBSWY3DP')).toBeInTheDocument();
        expect(screen.getByTitle('Código QR para la app autenticadora')).toBeInTheDocument();

        await user.type(screen.getByLabelText('Código de verificación'), '123456');
        await user.click(screen.getByRole('button', { name: 'Activar' }));

        expect(mfa.enable).toHaveBeenCalledWith('123456');
        expect(await screen.findByRole('list', { name: 'Códigos de recuperación' })).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(10);
        expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Descargar .txt' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Ya los guardé' }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('cannot be dismissed from the backdrop while the recovery codes are shown', async () => {
        mfa.setup.mockResolvedValue({ secret: 'S', otpauthUri: 'otpauth://x' });
        mfa.enable.mockResolvedValue({ recoveryCodes: codes });
        const onClose = vi.fn();
        render(<SecurityModal onClose={onClose} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }));
        await user.type(await screen.findByLabelText('Código de verificación'), '123456');
        await user.click(screen.getByRole('button', { name: 'Activar' }));
        await screen.findByRole('list', { name: 'Códigos de recuperación' });

        await user.click(screen.getByRole('dialog').parentElement!);

        expect(onClose).not.toHaveBeenCalled();
    });

    it('says so when the 2FA is already active', async () => {
        mfa.setup.mockRejectedValue(httpError(409));
        render(<SecurityModal onClose={vi.fn()} />);

        await userEvent.setup().click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('ya está activa');
    });

    it('shows "El código no es válido" when the first code is wrong', async () => {
        mfa.setup.mockResolvedValue({ secret: 'S', otpauthUri: 'otpauth://x' });
        mfa.enable.mockRejectedValue(httpError(400));
        render(<SecurityModal onClose={vi.fn()} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Activar verificación en dos pasos' }));

        await user.type(await screen.findByLabelText('Código de verificación'), '000000');
        await user.click(screen.getByRole('button', { name: 'Activar' }));

        expect(await screen.findByText('El código no es válido')).toBeInTheDocument();
    });

    it('regenerates the recovery codes with a current code', async () => {
        mfa.regenerateRecoveryCodes.mockResolvedValue({ recoveryCodes: codes });
        render(<SecurityModal onClose={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Generar códigos de recuperación nuevos' }));
        await user.type(screen.getByLabelText('Código de verificación'), '654321');
        await user.click(screen.getByRole('button', { name: 'Generar códigos nuevos' }));

        await waitFor(() => expect(mfa.regenerateRecoveryCodes).toHaveBeenCalledWith('654321'));
        expect(await screen.findAllByRole('listitem')).toHaveLength(10);
    });

    it('disables the 2FA with the password (CA5)', async () => {
        mfa.disable.mockResolvedValue(undefined);
        render(<SecurityModal onClose={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Desactivar' }));
        await user.type(screen.getByLabelText('Contraseña'), 'Secreta123');
        await user.click(screen.getByRole('button', { name: 'Desactivar' }));

        expect(mfa.disable).toHaveBeenCalledWith('Secreta123');
        expect(await screen.findByRole('status')).toHaveTextContent('Desactivaste la verificación en dos pasos');
    });

    it('shows "La contraseña es incorrecta" when the password is wrong', async () => {
        mfa.disable.mockRejectedValue(httpError(401));
        render(<SecurityModal onClose={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Desactivar' }));
        await user.type(screen.getByLabelText('Contraseña'), 'mala');
        await user.click(screen.getByRole('button', { name: 'Desactivar' }));

        expect(await screen.findByText('La contraseña es incorrecta')).toBeInTheDocument();
    });
});
