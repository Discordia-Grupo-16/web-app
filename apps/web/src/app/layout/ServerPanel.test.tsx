import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BAN_MEMBERS,
    KICK_MEMBERS,
    MANAGE_CHANNELS,
    MANAGE_ROLES,
    PERMISSION_COPY,
    SEND_MESSAGES,
    VIEW_CHANNEL,
} from '@discordia/core';
import type { Server, ServerBan, ServerMember } from '@discordia/api';
import { membersService, rolesService, serversService } from '@/shared/api';
import { ServerPanel } from './ServerPanel';

const OWNER = 'owner';
const ME = 'me';

vi.mock('@/shared/api', () => ({
    serversService: { getServer: vi.fn() },
    rolesService: { listRoles: vi.fn() },
    membersService: {
        listMembers: vi.fn(),
        banMember: vi.fn(),
        kickMember: vi.fn(),
        listBans: vi.fn(),
        revokeBan: vi.fn(),
    },
}));
vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    useAuth: () => ({ user: { id: ME, name: 'Yo', avatarUrl: null } }),
    usePublicProfiles: () => new Map(),
    // The voice call list under a channel has its own tests (ServerPanel.voice.test.tsx).
    useVoice: () => ({ call: { status: 'idle' } }),
    useVoiceCallParticipants: () => [],
}));
// El botón real depende de un contexto que este panel no provee: acá solo importa si aparece.
vi.mock('@/features/invitations', () => ({ InviteButton: () => <button>Invitar</button> }));
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

const MILTON: ServerMember = {
    user_id: 'milton',
    joined_at: '2026-10-01T00:00:00Z',
    roles: [],
};

const BAN_OF_MILTON: ServerBan = {
    user_id: 'milton',
    banned_by: ME,
    reason: null,
    created_at: '2026-10-01T12:00:00',
};

const renderPanel = async (
    myPermissions: number,
    ownerId = OWNER,
    members: ServerMember[] = [],
) => {
    vi.mocked(serversService.getServer).mockResolvedValue(server(myPermissions, ownerId));
    vi.mocked(rolesService.listRoles).mockResolvedValue([]);
    vi.mocked(membersService.listMembers).mockResolvedValue(members);
    vi.mocked(membersService.listBans).mockResolvedValue([]);
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
const bansHeader = () => screen.queryByText(/^Baneados — /);
// Por el prefijo y no por el nombre: acá los perfiles públicos están mockeados
// vacíos, así que el nombre lo resuelve el fallback y no es lo que se mira.
const banMember = () => screen.queryByTitle(/^Banear a /);

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

    it('BAN_MEMBERS habilita banear, y MANAGE_ROLES por su cuenta no', async () => {
        // Son dos bits distintos: gestionar roles no es moderar. Si el panel
        // pasara el mismo booleano a las dos cosas, esto lo encuentra.
        await renderPanel(VIEW_CHANNEL | MANAGE_ROLES, OWNER, [MILTON]);

        expect(banMember()).not.toBeInTheDocument();
    });

    it('con BAN_MEMBERS aparece la acción de banear', async () => {
        await renderPanel(VIEW_CHANNEL | BAN_MEMBERS, OWNER, [MILTON]);

        expect(banMember()).toBeInTheDocument();
    });

    it('sin BAN_MEMBERS no aparece la sección de baneados ni se piden', async () => {
        // Ocultar no es autorizar: el 403 de verdad está en `community`. Pero pedir la lista
        // sin el bit sería un error en la consola en cada poll.
        await renderPanel(VIEW_CHANNEL | KICK_MEMBERS | MANAGE_ROLES, OWNER, [MILTON]);

        expect(bansHeader()).not.toBeInTheDocument();
        expect(membersService.listBans).not.toHaveBeenCalled();
    });

    it('con BAN_MEMBERS aparece la sección de baneados', async () => {
        await renderPanel(VIEW_CHANNEL | BAN_MEMBERS);

        expect(await screen.findByText(PERMISSION_COPY.bansTitle(0))).toBeInTheDocument();
        expect(membersService.listBans).toHaveBeenCalledWith('srv');
    });

    it('al banear desde Miembros, el baneado aparece en Baneados sin esperar al poll', async () => {
        vi.mocked(membersService.banMember).mockResolvedValue(undefined);
        await renderPanel(VIEW_CHANNEL | BAN_MEMBERS, OWNER, [MILTON]);
        await screen.findByText(PERMISSION_COPY.bansTitle(0));
        vi.mocked(membersService.listBans).mockResolvedValue([BAN_OF_MILTON]);
        const user = userEvent.setup();

        await user.click(banMember()!);
        await user.click(screen.getByRole('button', { name: PERMISSION_COPY.banConfirm }));

        expect(await screen.findByText(PERMISSION_COPY.bansTitle(1))).toBeInTheDocument();
        expect(banMember()).not.toBeInTheDocument();
    });

    it('irse del servidor sigue decidiéndose por ser dueño, no por un bit', async () => {
        // No es un permiso sino una condición: el dueño no puede irse, elimina.
        await renderPanel(VIEW_CHANNEL | MANAGE_ROLES, ME);

        expect(screen.queryByText(/abandonar/i)).not.toBeInTheDocument();
    });
});

describe('ServerPanel: invitar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('el dueño ve el botón de invitar', async () => {
        await renderPanel(VIEW_CHANNEL, ME);

        expect(screen.getByRole('button', { name: 'Invitar' })).toBeInTheDocument();
    });

    it('un miembro que no es dueño no lo ve', async () => {
        await renderPanel(VIEW_CHANNEL);

        expect(screen.queryByRole('button', { name: 'Invitar' })).not.toBeInTheDocument();
    });
});