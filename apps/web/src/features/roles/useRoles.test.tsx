import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { useRoles } from './useRoles';

vi.mock('@/shared/api', () => ({ rolesService: { listRoles: vi.fn() } }));

const role = (id: string, name: string, isDefault = false): Role => ({
    id,
    server_id: 'srv',
    name,
    is_default: isDefault,
    permissions: 3,
    permission_names: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
    position: 0,
    created_at: '2026-10-01T00:00:00Z',
});

const loaded = async (roles: Role[]) => {
    vi.mocked(rolesService.listRoles).mockResolvedValue(roles);
    const { result } = renderHook(() => useRoles('srv'));
    await waitFor(() => expect(result.current.roles).toHaveLength(roles.length));
    return result;
};

describe('useRoles updateRole', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marcar un rol como defecto desmarca el anterior', async () => {
        // El backend lo desmarca en la misma transacción. Sin replicarlo acá,
        // la lista muestra dos insignias "Por defecto" hasta recargar.
        const result = await loaded([role('r1', 'everyone', true), role('r2', 'Miembro')]);

        act(() => result.current.updateRole(role('r2', 'Miembro', true)));

        const defaults = result.current.roles.filter(r => r.is_default).map(r => r.name);
        expect(defaults).toEqual(['Miembro']);
    });

    it('editar un rol que no es el defecto no toca al que lo es', async () => {
        const result = await loaded([role('r1', 'everyone', true), role('r2', 'Miembro')]);

        act(() => result.current.updateRole({ ...role('r2', 'Moderador'), permissions: 1 }));

        expect(result.current.roles.map(r => [r.name, r.is_default])).toEqual([
            ['everyone', true],
            ['Moderador', false],
        ]);
    });
});
