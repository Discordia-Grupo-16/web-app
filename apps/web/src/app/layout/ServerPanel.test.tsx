import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MANAGE_CHANNELS,
    MANAGE_ROLES,
    PERMISSION_COPY,
    SEND_MESSAGES,
    VIEW_CHANNEL,
} from '@discordia/core';
import type { Server } from '@discordia/api';
import { membersService, rolesService, serversService } from '@/shared/api';
import { ServerPanel } from './ServerPanel';

const OWNER = 'owner';
const ME = 'me';

vi.mock('@/shared/api', () => ({
    serversService: { getServer: vi.fn() },
    rolesService: { listRoles: vi.fn() },
    membersService: { listMembers: vi.fn() },
}));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: ME, name: 'Yo', avatarUrl: null } }),
    usePublicProfiles: () => new Map(),
}));
// Dependen de un contexto que este panel no provee y que no es lo que se mira acá.
vi.mock('@/features/invitations', () => ({ InviteButton: () => null }));
vi.mock('@/shared/profile/ProfileViewerContext', () => ({
    useProfileViewer: () => ({ openProfile: vi.fn() }),
}));

const server = (myPermissions: number, ownerId = OWNER): Server => ({
    id: 'srv',
    name: 'Discordia',
    description: null,
    owner_id: ownerId,
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

const renderPanel = async (myPermissions: number, ownerId = OWNER) => {
    vi.mocked(serversService.getServer).mockResolvedValue(server(myPermissions, ownerId));
    vi.mocked(rolesService.listRoles).mockResolvedValue([]);
    vi.mocked(membersService.listMembers).mockResolvedValue([]);
    render(
        <MemoryRouter initialEntries={['/servers/srv']}>
            <Routes>
                <Route path="/servers/:serverId" element={<ServerPanel />} />
            </Routes>
        </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('general')).toBeInTheDocument());
};

// Los botones de administración de cada sección, por su tooltip.
const createTextChannel = () => screen.queryByTitle('Crear canal de texto');
const createRole = () => screen.queryByTitle('Crear rol');
const membersHeader = () => screen.queryByText(PERMISSION_COPY.membersTitle(0));

describe('ServerPanel: qué se ve según el permiso', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('MANAGE_CHANNELS habilita solo los canales', async () => {
        await renderPanel(VIEW_CHANNEL | MANAGE_CHANNELS);

        expect(createTextChannel()).toBeInTheDocument();
        expect(createRole()).not.toBeInTheDocument();
    });

    it('MANAGE_ROLES habilita solo los roles', async () => {
        await renderPanel(VIEW_CHANNEL | MANAGE_ROLES);

        expect(createRole()).toBeInTheDocument();
        expect(createTextChannel()).not.toBeInTheDocument();
    });

    it('un moderador con los dos permisos ve los dos', async () => {
        // El caso que el chequeo por `owner_id` escondía: no es dueño y
        // administra igual.
        await renderPanel(VIEW_CHANNEL | MANAGE_CHANNELS | MANAGE_ROLES);

        expect(createTextChannel()).toBeInTheDocument();
        expect(createRole()).toBeInTheDocument();
    });

    it('un miembro común no ve ningún botón de administración', async () => {
        await renderPanel(VIEW_CHANNEL | SEND_MESSAGES);

        expect(createTextChannel()).not.toBeInTheDocument();
        expect(createRole()).not.toBeInTheDocument();
    });

    it('el dueño sin bits tampoco: lo que manda es my_permissions', async () => {
        // `community` le manda al owner todos los bits, así que un cero acá
        // sería un bug del backend. El panel no lo compensa comparando ids:
        // este test fija que no volvió el chequeo por `owner_id`.
        await renderPanel(VIEW_CHANNEL, ME);

        expect(createTextChannel()).not.toBeInTheDocument();
        expect(createRole()).not.toBeInTheDocument();
    });

    it('la sección de miembros se ve siempre', async () => {
        // Ver quién está no es gestionar: el backend tampoco pide MANAGE_ROLES
        // para el listado.
        await renderPanel(VIEW_CHANNEL);

        expect(membersHeader()).toBeInTheDocument();
    });

    it('irse del servidor sigue decidiéndose por ser dueño, no por un bit', async () => {
        // No es un permiso sino una condición: el dueño no puede irse, elimina.
        await renderPanel(VIEW_CHANNEL | MANAGE_ROLES, ME);

        expect(screen.queryByText(/abandonar/i)).not.toBeInTheDocument();
    });
});
