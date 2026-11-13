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

interface Options {
    isOwner?: boolean;
    pendingTransferTo?: string | null;
    onDeleteRequested?: () => void;
}

const onTransferRequested = vi.fn();

const renderButton = ({ isOwner = false, pendingTransferTo = null, onDeleteRequested }: Options = {}) =>
    render(
        <MemoryRouter>
            <LeaveServerButton
                serverId="srv"
                isOwner={isOwner}
                pendingTransferTo={pendingTransferTo}
                onTransferRequested={onTransferRequested}
                onDeleteRequested={onDeleteRequested}
            />
        </MemoryRouter>,
    );

const OWNER_MESSAGE = 'Para abandonar el servidor, primero transferí el servidor o eliminalo.';

const confirmLeaving = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Abandonar servidor' }));
    await user.click(screen.getByRole('button', { name: 'Abandonar' }));
};

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

    describe('as the owner', () => {
        it('does not leave and says to transfer the ownership first', async () => {
            renderButton({ isOwner: true });
            const user = userEvent.setup();

            await confirmLeaving(user);

            expect(serversService.leaveServer).not.toHaveBeenCalled();
            expect(screen.getByText(OWNER_MESSAGE)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Transferir servidor' })).toBeInTheDocument();
        });

        it('names the recipient of the pending transfer', async () => {
            renderButton({ isOwner: true, pendingTransferTo: 'Beto' });
            const user = userEvent.setup();

            await confirmLeaving(user);

            expect(screen.getByText(`${OWNER_MESSAGE} Ya hay una transferencia pendiente a Beto.`)).toBeInTheDocument();
        });

        it('takes the owner to transfer the ownership', async () => {
            renderButton({ isOwner: true });
            const user = userEvent.setup();

            await confirmLeaving(user);
            await user.click(screen.getByRole('button', { name: 'Transferir servidor' }));

            expect(onTransferRequested).toHaveBeenCalled();
        });

        it('offers deleting the server only when it can be deleted', async () => {
            const onDeleteRequested = vi.fn();
            const { unmount } = renderButton({ isOwner: true });
            const user = userEvent.setup();
            await confirmLeaving(user);
            expect(screen.queryByRole('button', { name: 'Eliminar servidor' })).not.toBeInTheDocument();
            unmount();

            renderButton({ isOwner: true, onDeleteRequested });
            await confirmLeaving(user);
            await user.click(screen.getByRole('button', { name: 'Eliminar servidor' }));

            expect(onDeleteRequested).toHaveBeenCalled();
        });
    });

    it('shows the owner message when the backend says the user is the owner', async () => {
        vi.mocked(serversService.leaveServer).mockRejectedValue({ response: { status: 409 } });
        renderButton();
        const user = userEvent.setup();

        await confirmLeaving(user);

        expect(await screen.findByText(OWNER_MESSAGE)).toBeInTheDocument();
        expect(navigate).not.toHaveBeenCalled();
    });
});
