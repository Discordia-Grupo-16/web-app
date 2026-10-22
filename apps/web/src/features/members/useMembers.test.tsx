import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role, ServerMember } from '@discordia/api';
import { membersService } from '@/shared/api';
import { useMembers } from './useMembers';

vi.mock('@/shared/api', () => ({ membersService: { listMembers: vi.fn() } }));

const role = (id: string, name: string, position: number): Role => ({
    id,
    server_id: 'srv',
    name,
    is_default: false,
    permissions: 0,
    permission_names: [],
    position,
    created_at: '2026-10-01T00:00:00Z',
});

const BAJO = role('r1', 'Novato', 1);
const ALTO = role('r2', 'Admin', 5);

describe('useMembers setMemberRoles', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('ordena los roles por position, no por el orden en que llegan', async () => {
        // La lista nombra al miembro por su rol más alto, que es el último.
        // Asignar uno de menor posición y dejarlo al final lo haría aparecer
        // como el más alto.
        const member: ServerMember = {
            user_id: 'u1',
            joined_at: '2026-10-01T00:00:00Z',
            roles: [ALTO],
        };
        vi.mocked(membersService.listMembers).mockResolvedValue([member]);
        const { result } = renderHook(() => useMembers('srv'));
        await waitFor(() => expect(result.current.members).toHaveLength(1));

        act(() => result.current.setMemberRoles('u1', [ALTO, BAJO]));

        expect(result.current.members[0].roles.map(r => r.name)).toEqual(['Novato', 'Admin']);
    });

    it('no toca a los demás miembros', async () => {
        const members: ServerMember[] = [
            { user_id: 'u1', joined_at: '2026-10-01T00:00:00Z', roles: [] },
            { user_id: 'u2', joined_at: '2026-10-01T00:00:00Z', roles: [ALTO] },
        ];
        vi.mocked(membersService.listMembers).mockResolvedValue(members);
        const { result } = renderHook(() => useMembers('srv'));
        await waitFor(() => expect(result.current.members).toHaveLength(2));

        act(() => result.current.setMemberRoles('u1', [BAJO]));

        expect(result.current.members[1].roles.map(r => r.name)).toEqual(['Admin']);
    });
});
