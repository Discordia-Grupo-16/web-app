import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServerBan } from '@discordia/api';
import { membersService } from '@/shared/api';
import { useBans } from './useBans';

vi.mock('@/shared/api', () => ({ membersService: { listBans: vi.fn() } }));

const ban = (userId: string): ServerBan => ({
    user_id: userId,
    banned_by: 'mod',
    reason: null,
    created_at: '2026-10-01T00:00:00Z',
});

describe('useBans', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sin BAN_MEMBERS no le pide nada al backend', async () => {
        // El GET daría 403: pedirlo igual sería un error en la consola en cada poll.
        const { result } = renderHook(() => useBans('srv', false));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(membersService.listBans).not.toHaveBeenCalled();
        expect(result.current.bans).toEqual([]);
    });

    it('con BAN_MEMBERS carga los baneos del servidor', async () => {
        vi.mocked(membersService.listBans).mockResolvedValue([ban('u1')]);

        const { result } = renderHook(() => useBans('srv', true));

        await waitFor(() => expect(result.current.bans).toHaveLength(1));
        expect(membersService.listBans).toHaveBeenCalledWith('srv');
    });

    it('carga cuando el permiso llega después', async () => {
        // Es el caso real: el panel arranca sin permisos hasta que carga el servidor.
        vi.mocked(membersService.listBans).mockResolvedValue([ban('u1')]);
        const { result, rerender } = renderHook(({ enabled }) => useBans('srv', enabled), {
            initialProps: { enabled: false },
        });

        rerender({ enabled: true });

        await waitFor(() => expect(result.current.bans).toHaveLength(1));
    });

    it('removeBan saca solo esa fila', async () => {
        vi.mocked(membersService.listBans).mockResolvedValue([ban('u1'), ban('u2')]);
        const { result } = renderHook(() => useBans('srv', true));
        await waitFor(() => expect(result.current.bans).toHaveLength(2));

        act(() => result.current.removeBan('u1'));

        expect(result.current.bans.map(b => b.user_id)).toEqual(['u2']);
    });

    it('reload trae al recién baneado sin esperar al poll', async () => {
        vi.mocked(membersService.listBans).mockResolvedValue([]);
        const { result } = renderHook(() => useBans('srv', true));
        await waitFor(() => expect(membersService.listBans).toHaveBeenCalledTimes(1));
        vi.mocked(membersService.listBans).mockResolvedValue([ban('u1')]);

        act(() => result.current.reload());

        await waitFor(() => expect(result.current.bans).toHaveLength(1));
    });

    it('descarta la respuesta tardía de un reload del servidor anterior', async () => {
        // El poll usa el mismo reload: si al cambiar de servidor queda uno en vuelo, su
        // respuesta no puede pisar la lista del servidor nuevo con baneos del viejo.
        vi.mocked(membersService.listBans).mockResolvedValueOnce([]);
        const { result, rerender } = renderHook(({ serverId }) => useBans(serverId, true), {
            initialProps: { serverId: 'srv-a' },
        });
        await waitFor(() => expect(membersService.listBans).toHaveBeenCalledTimes(1));

        let answerOld!: (bans: ServerBan[]) => void;
        vi.mocked(membersService.listBans).mockImplementationOnce(
            () => new Promise(resolve => (answerOld = resolve)),
        );
        act(() => result.current.reload());
        vi.mocked(membersService.listBans).mockResolvedValueOnce([ban('de-b')]);
        rerender({ serverId: 'srv-b' });
        await waitFor(() => expect(result.current.bans.map(b => b.user_id)).toEqual(['de-b']));

        await act(async () => answerOld([ban('de-a')]));

        expect(result.current.bans.map(b => b.user_id)).toEqual(['de-b']);
    });

    it('si falla la carga del servidor nuevo, no deja los baneos del anterior', async () => {
        // Con la lista vieja en pantalla, revocar le pegaría al servidor nuevo con un usuario
        // del viejo, y el DELETE idempotente respondería 204 sin haber hecho nada.
        const silenced = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(membersService.listBans).mockResolvedValueOnce([ban('de-a')]);
        const { result, rerender } = renderHook(({ serverId }) => useBans(serverId, true), {
            initialProps: { serverId: 'srv-a' },
        });
        await waitFor(() => expect(result.current.bans).toHaveLength(1));
        expect(result.current.error).toBe(false);

        vi.mocked(membersService.listBans).mockRejectedValueOnce(new Error('500'));
        rerender({ serverId: 'srv-b' });

        await waitFor(() => expect(result.current.error).toBe(true));
        expect(result.current.bans).toEqual([]);
        expect(result.current.loading).toBe(false);
        silenced.mockRestore();
    });
});
