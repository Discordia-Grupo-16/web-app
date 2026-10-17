import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSION_COPY, VIEW_CHANNEL, SEND_MESSAGES } from '@discordia/core';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { ChannelView } from './ChannelView';

vi.mock('@/shared/api', () => ({ serversService: { getServer: vi.fn() } }));
// El chat real abre un socket: no es lo que este test mira.
vi.mock('./ChatPanel', () => ({
    ChatPanel: ({ canSendMessages }: { canSendMessages: boolean }) => (
        <div>{canSendMessages ? 'puede escribir' : PERMISSION_COPY.cannotSendMessage('general')}</div>
    ),
}));

const server = (myPermissions: number): Server => ({
    id: 'srv',
    name: 'Discordia',
    description: null,
    owner_id: 'owner',
    avatar_url: null,
    created_at: '2026-10-01T00:00:00Z',
    my_permissions: myPermissions,
    my_permission_names: [],
    channels: [
        {
            id: 'c1',
            server_id: 'srv',
            name: 'general',
            type: 'text',
            topic: null,
            position: 0,
            created_at: '2026-10-01T00:00:00Z',
        },
    ],
});

const renderView = () =>
    render(
        <MemoryRouter initialEntries={['/servers/srv/channels/c1']}>
            <Routes>
                <Route path="/servers/:serverId/channels/:channelId" element={<ChannelView />} />
            </Routes>
        </MemoryRouter>,
    );

describe('ChannelView y SEND_MESSAGES', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('con el permiso, el compositor se puede usar', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | SEND_MESSAGES));

        renderView();

        expect(await screen.findByText('puede escribir')).toBeInTheDocument();
    });

    it('sin el permiso, dice por qué', async () => {
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL));

        renderView();

        expect(
            await screen.findByText(PERMISSION_COPY.cannotSendMessage('general')),
        ).toBeInTheDocument();
    });

    it('refresca el permiso sin cambiar de canal ni recargar', async () => {
        // Es lo que SCRUM-61 tiene que mostrar en la demo: cambiarle el rol a
        // alguien y ver el efecto. Y es el punto 2 del DoD: el mobile ya lo
        // hacía, así que sin esto las dos plataformas no hacen lo mismo.
        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL | SEND_MESSAGES));
        renderView();
        await screen.findByText('puede escribir');

        vi.mocked(serversService.getServer).mockResolvedValue(server(VIEW_CHANNEL));
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() =>
            expect(
                screen.getByText(PERMISSION_COPY.cannotSendMessage('general')),
            ).toBeInTheDocument(),
        );
    });
});
