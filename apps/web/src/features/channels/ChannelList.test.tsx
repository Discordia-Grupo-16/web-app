import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Channel } from '@discordia/api';
import { categoriesService, channelsService } from '@/shared/api';
import { ChannelList } from './ChannelList';

const navigate = vi.fn();

vi.mock('@/shared/api', () => ({
    channelsService: { createChannel: vi.fn(), updateChannel: vi.fn(), deleteChannel: vi.fn() },
    categoriesService: { createCategory: vi.fn(), renameCategory: vi.fn(), deleteCategory: vi.fn() },
}));
vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => navigate,
}));

const channel = (id: string, name: string, type: Channel['type'] = 'text', categoryId: string | null = null): Channel => ({
    id,
    server_id: 'srv',
    category_id: categoryId,
    name,
    type,
    topic: null,
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

const category = (id: string, name: string): Category => ({
    id,
    server_id: 'srv',
    name,
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

        expect(channelsService.updateChannel).toHaveBeenCalledWith('srv', 'c1', 'general', 'charla', undefined);
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

    it('draws what renderBelowChannel returns under the given channel', () => {
        renderList({ renderBelowChannel: (ch) => (ch.id === 'c2' ? <p>En la llamada</p> : null) });

        const lobbyRow = screen.getByRole('button', { name: 'lobby' }).closest('div')!.parentElement!;
        expect(within(lobbyRow).getByText('En la llamada')).toBeInTheDocument();
        const generalRow = screen.getByRole('button', { name: 'general' }).closest('div')!.parentElement!;
        expect(within(generalRow).queryByText('En la llamada')).not.toBeInTheDocument();
    });

    it('draws nothing extra without renderBelowChannel', () => {
        renderList();

        expect(screen.queryByText('En la llamada')).not.toBeInTheDocument();
    });

    it('picks the icon by the channel type', () => {
        renderList();

        expect(screen.getByRole('button', { name: 'lobby' }).querySelector('[data-icon="voice"]')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'general' }).querySelector('[data-icon="text"]')).not.toBeNull();
    });

    it('shows channels under their category', () => {
        const cat = category('cat-1', 'Categoría A');
        const inCat = channel('c3', 'en-categoria', 'text', 'cat-1');
        renderList({ channels: [general, lobby, inCat], categories: [cat] });

        expect(screen.getByText('Categoría A')).toBeInTheDocument();
        expect(screen.getByText('en-categoria')).toBeInTheDocument();
    });

    it('uncategorized channels still show in text/voice groups', () => {
        const cat = category('cat-1', 'Categoría A');
        renderList({ categories: [cat] });

        expect(screen.getByText('Canales de texto')).toBeInTheDocument();
        expect(screen.getByText('Canales de voz')).toBeInTheDocument();
        expect(screen.getByText('general')).toBeInTheDocument();
        expect(screen.getByText('lobby')).toBeInTheDocument();
    });

    it('shows the new category button when canManage', () => {
        renderList({ canManage: true });
        expect(screen.getByTitle('Crear categoría')).toBeInTheDocument();
    });

    it('hides the new category button when cannot manage', () => {
        renderList({ canManage: false });
        expect(screen.queryByTitle('Crear categoría')).not.toBeInTheDocument();
    });

    it('creates a category and adds it to the list', async () => {
        const created = category('cat-1', 'Nueva Cat');
        vi.mocked(categoriesService.createCategory).mockResolvedValue(created);
        const onCategoriesChange = vi.fn();
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <ChannelList
                    serverId="srv"
                    channels={[general]}
                    canManage
                    onChannelsChange={vi.fn()}
                    onCategoriesChange={onCategoriesChange}
                />
            </MemoryRouter>,
        );

        await user.click(screen.getByTitle('Crear categoría'));
        await user.type(screen.getByPlaceholderText('Nombre de la categoría'), 'Nueva Cat');
        await user.click(screen.getByRole('button', { name: 'Crear' }));

        expect(categoriesService.createCategory).toHaveBeenCalledWith('srv', 'Nueva Cat');
        expect(onCategoriesChange).toHaveBeenCalled();
    });

    it('deletes a category after confirming', async () => {
        vi.mocked(categoriesService.deleteCategory).mockResolvedValue();
        const cat = category('cat-1', 'ToDelete');
        const onCategoriesChange = vi.fn();
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <ChannelList
                    serverId="srv"
                    channels={[general]}
                    categories={[cat]}
                    canManage
                    onChannelsChange={vi.fn()}
                    onCategoriesChange={onCategoriesChange}
                />
            </MemoryRouter>,
        );

        await user.click(screen.getByTitle('Eliminar categoría'));
        await user.click(screen.getByRole('button', { name: 'Eliminar' }));

        expect(categoriesService.deleteCategory).toHaveBeenCalledWith('srv', 'cat-1');
        expect(onCategoriesChange).toHaveBeenCalled();
    });
});
