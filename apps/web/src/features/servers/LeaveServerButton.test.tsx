import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serversService } from '@/shared/api';
import { LeaveServerButton } from './LeaveServerButton';

const navigate = vi.fn();

vi.mock('@/shared/api', () => ({ serversService: { leaveServer: vi.fn() } }));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const renderButton = () =>
    render(
        <MemoryRouter>
            <LeaveServerButton serverId="srv" />
        </MemoryRouter>,
    );

describe('LeaveServerButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('asks for confirmation before leaving', async () => {
        renderButton();
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Abandonar servidor' }));
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(serversService.leaveServer).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('leaves the server and goes home', async () => {
        vi.mocked(serversService.leaveServer).mockResolvedValue();
        renderButton();
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Abandonar servidor' }));
        await user.click(screen.getByRole('button', { name: 'Abandonar' }));

        expect(serversService.leaveServer).toHaveBeenCalledWith('srv');
        expect(navigate).toHaveBeenCalledWith('/');
    });

    it('stays and shows the error when leaving fails', async () => {
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.mocked(serversService.leaveServer).mockRejectedValue(new Error('network'));
        renderButton();
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Abandonar servidor' }));
        await user.click(screen.getByRole('button', { name: 'Abandonar' }));

        expect(alert).toHaveBeenCalledWith('Error al abandonar el servidor');
        expect(navigate).not.toHaveBeenCalled();
    });
});
