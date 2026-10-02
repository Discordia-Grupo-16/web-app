import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Channel } from '@discordia/api';
import { channelsService } from '@/shared/api';
import { ChannelList } from './ChannelList';

const navigate = vi.fn();

vi.mock('@/shared/api', () => ({
    channelsService: { createChannel: vi.fn(), updateChannel: vi.fn(), deleteChannel: vi.fn() },
}));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const channel = (id: string, name: string, type: Channel['type'] = 'text'): Channel => ({
    id,
    server_id: 'srv',
    name,
    type,
    topic: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

const general = channel('c1', 'general');
const lobby = channel('c2', 'lobby', 'voice');

// onChannelsChange receives an updater: apply it to the channels the list was given.
const renderList = (props: Partial<Parameters<typeof ChannelList>[0]> = {}) => {
    const onChannelsChange = vi.fn();
    render(
        <MemoryRouter>
            <ChannelList
                serverId="srv"
                channels={[general, lobby]}
                canManage
                onChannelsChange={onChannelsChange}
                {...props}
            />
        </MemoryRouter>,
    );
    const applied = () => onChannelsChange.mock.calls.reduce((list, [update]) => update(list), [general, lobby]);
    return { onChannelsChange, applied };
};

describe('ChannelList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('groups text and voice channels', () => {
        renderList();
        expect(screen.getByText('Canales de texto')).toBeInTheDocument();
        expect(screen.getByText('general')).toBeInTheDocument();
        expect(screen.getByText('lobby')).toBeInTheDocument();
    });

    it('hides the management buttons for members who cannot manage', () => {
        renderList({ canManage: false });
        expect(screen.queryByTitle('Crear canal de texto')).not.toBeInTheDocument();
        expect(screen.queryByTitle('Eliminar canal')).not.toBeInTheDocument();
    });

    it('creates a channel, adds it to the list and opens it', async () => {
        const created = channel('c3', 'nuevo-canal');
        vi.mocked(channelsService.createChannel).mockResolvedValue(created);
        const { applied } = renderList();
        const user = userEvent.setup();

        await user.click(screen.getByTitle('Crear canal de texto'));
        await user.type(screen.getByPlaceholderText('nuevo-canal'), 'Nuevo Canal');
        await user.click(screen.getByRole('button', { name: 'Crear canal' }));

        expect(channelsService.createChannel).toHaveBeenCalledWith('srv', 'nuevo-canal', 'text');
        expect(applied()).toEqual([general, lobby, created]);
        expect(navigate).toHaveBeenCalledWith('/servers/srv/channels/c3');
    });

    it('edits a channel in place', async () => {
        const updated = { ...general, topic: 'charla' };
        vi.mocked(channelsService.updateChannel).mockResolvedValue(updated);
        const { applied } = renderList();
        const user = userEvent.setup();

        await user.click(screen.getAllByTitle('Editar canal')[0]);
        await user.type(screen.getByPlaceholderText('Descripción opcional del canal'), 'charla');
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

        expect(channelsService.updateChannel).toHaveBeenCalledWith('srv', 'c1', 'general', 'charla');
        expect(applied()).toEqual([updated, lobby]);
    });

    it('deletes a channel after confirming and leaves it if it was open', async () => {
        vi.mocked(channelsService.deleteChannel).mockResolvedValue();
        const { applied } = renderList({ activeChannelId: 'c1' });
        const user = userEvent.setup();

        await user.click(screen.getAllByTitle('Eliminar canal')[0]);
        expect(channelsService.deleteChannel).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Eliminar' }));

        expect(channelsService.deleteChannel).toHaveBeenCalledWith('srv', 'c1');
        expect(applied()).toEqual([lobby]);
        expect(navigate).toHaveBeenCalledWith('/servers/srv');
    });

    it('keeps the channel and shows the server error when the delete fails', async () => {
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.mocked(channelsService.deleteChannel).mockRejectedValue({ response: { data: { detail: 'Sin permiso' } } });
        const { onChannelsChange } = renderList();
        const user = userEvent.setup();

        await user.click(screen.getAllByTitle('Eliminar canal')[0]);
        await user.click(screen.getByRole('button', { name: 'Eliminar' }));

        expect(alert).toHaveBeenCalledWith('Sin permiso');
        expect(onChannelsChange).not.toHaveBeenCalled();
    });
});
