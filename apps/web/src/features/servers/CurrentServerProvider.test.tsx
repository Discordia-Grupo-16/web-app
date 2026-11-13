import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { CurrentServerProvider } from './CurrentServerProvider';
import { useCurrentServer } from './currentServerContext';

vi.mock('@/shared/api', () => ({ serversService: { getServer: vi.fn() } }));

const server = { id: 'srv', name: 'Discordia', channels: [] } as unknown as Server;

const Consumer = ({ label }: { label: string }) => {
    const { server: current } = useCurrentServer();
    return <p>{label}: {current?.name ?? 'cargando'}</p>;
};

describe('CurrentServerProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(serversService.getServer).mockResolvedValue(server);
    });

    // Es lo que se arregló: el panel lateral y la pantalla del canal pedían el mismo servidor por
    // separado, así que cada cambio costaba dos requests.
    it('loads the server of the URL once for every consumer under it', async () => {
        render(
            <MemoryRouter initialEntries={['/servers/srv/channels/c1']}>
                <Routes>
                    <Route
                        path="/servers/:serverId/channels/:channelId"
                        element={
                            <CurrentServerProvider>
                                <Consumer label="panel" />
                                <Consumer label="canal" />
                            </CurrentServerProvider>
                        }
                    />
                </Routes>
            </MemoryRouter>,
        );

        await waitFor(() => expect(screen.getByText('panel: Discordia')).toBeInTheDocument());
        expect(screen.getByText('canal: Discordia')).toBeInTheDocument();
        expect(serversService.getServer).toHaveBeenCalledTimes(1);
    });

    it('fails loudly when a consumer has no provider above it', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => render(<Consumer label="solo" />)).toThrow(/CurrentServerProvider/);

        error.mockRestore();
    });
});
