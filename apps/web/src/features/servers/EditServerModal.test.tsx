import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { EditServerModal } from './EditServerModal';

vi.mock('@/shared/api', () => ({
    serversService: { updateServer: vi.fn() },
}));

const server: Server = {
    id: 'srv',
    name: 'Mi servidor',
    description: null,
    owner_id: 'owner',
    avatar_url: null,
    banner_url: null,
    created_at: '2026-10-01T00:00:00Z',
    my_permissions: 0,
    my_permission_names: [],
    channels: [],
    categories: [],
};

describe('EditServerModal', () => {
    const onClose = vi.fn();
    const onUpdated = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pre-rellena el nombre actual del servidor', () => {
        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);

        expect(screen.getByDisplayValue('Mi servidor')).toBeInTheDocument();
    });

    it('llama a updateServer con el nombre nuevo y cierra al guardar', async () => {
        const updated = { ...server, name: 'Nuevo nombre' };
        vi.mocked(serversService.updateServer).mockResolvedValue(updated);
        const user = userEvent.setup();

        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);
        const nameInput = screen.getByDisplayValue('Mi servidor');
        await user.clear(nameInput);
        await user.type(nameInput, 'Nuevo nombre');
        await user.click(screen.getByRole('button', { name: /guardar/i }));

        await waitFor(() => {
            expect(serversService.updateServer).toHaveBeenCalledWith(
                'srv',
                expect.objectContaining({ name: 'Nuevo nombre' }),
            );
        });
        expect(onUpdated).toHaveBeenCalledWith(updated);
        expect(onClose).toHaveBeenCalled();
    });

    it('muestra el error del servidor cuando falla', async () => {
        vi.mocked(serversService.updateServer).mockRejectedValue({
            response: { data: { detail: 'Nombre ya en uso' } },
        });
        const user = userEvent.setup();

        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);
        await user.click(screen.getByRole('button', { name: /guardar/i }));

        expect(await screen.findByText('Nombre ya en uso')).toBeInTheDocument();
        expect(onUpdated).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('muestra error genérico cuando el servidor no devuelve detail', async () => {
        vi.mocked(serversService.updateServer).mockRejectedValue(new Error('Network error'));
        const user = userEvent.setup();

        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);
        await user.click(screen.getByRole('button', { name: /guardar/i }));

        expect(await screen.findByText('Error al guardar los cambios')).toBeInTheDocument();
    });

    it('rechaza un ícono con formato inválido y no llama al servidor', () => {
        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);

        const iconInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
        const file = new File([new Uint8Array(100)], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(iconInput, { target: { files: [file] } });

        expect(screen.getByText(/formato no válido/i)).toBeInTheDocument();
        expect(serversService.updateServer).not.toHaveBeenCalled();
    });

    it('rechaza un ícono demasiado grande y no llama al servidor', () => {
        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);

        const iconInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
        const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'grande.png', { type: 'image/png' });
        fireEvent.change(iconInput, { target: { files: [big] } });

        expect(screen.getByText(/8 MB/i)).toBeInTheDocument();
        expect(serversService.updateServer).not.toHaveBeenCalled();
    });

    it('el botón de guardar queda deshabilitado con el nombre vacío', async () => {
        const user = userEvent.setup();
        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);

        await user.clear(screen.getByDisplayValue('Mi servidor'));

        expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    });

    it('el botón de guardar queda deshabilitado cuando hay un error de archivo inválido', () => {
        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);

        const iconInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
        fireEvent.change(iconInput, { target: { files: [new File([new Uint8Array(10)], 'doc.pdf', { type: 'application/pdf' })] } });

        expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
    });

    it('muestra el nombre del archivo rechazado en la etiqueta del ícono', () => {
        render(<EditServerModal server={server} onClose={onClose} onUpdated={onUpdated} />);

        const iconInput = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
        fireEvent.change(iconInput, { target: { files: [new File([new Uint8Array(10)], 'doc.pdf', { type: 'application/pdf' })] } });

        expect(screen.getByText(/doc\.pdf/i)).toBeInTheDocument();
    });
});
