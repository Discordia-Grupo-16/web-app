import { useCallback, useEffect, useState } from 'react';
import type { Role, ServerMember } from '@discordia/api';
import { membersService } from '@/shared/api';
import { usePolling } from '@/shared/hooks/usePolling';

/**
 * Los roles de un miembro, ordenados por `position` ascendente.
 *
 * `community` los devuelve así, y la lista nombra al miembro por su rol más
 * alto, que es el último. Al asignar uno de menor posición, agregarlo al final
 * lo haría aparecer como el más alto. Se ordena acá, donde se escribe el
 * estado, para que ningún llamador pueda olvidarse.
 */
const byPosition = (roles: Role[]): Role[] =>
    [...roles].sort((a, b) => a.position - b.position);

export const useMembers = (serverId: string | undefined) => {
    const [members, setMembers] = useState<ServerMember[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadMembers = async () => {
            if (!serverId) {
                setMembers([]);
                return;
            }

            setLoading(true);
            try {
                const list = await membersService.listMembers(serverId);
                if (isMounted) setMembers(list);
            } catch (err) {
                // A server that is gone is handled by whoever loads the server.
                console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadMembers();

        return () => {
            isMounted = false;
        };
    }, [serverId]);

    // Quien entra al servidor después de que se cargó la lista no aparecía
    // hasta recargar, así que no se le podía asignar un rol. Mismo poll que
    // los canales: nada de esto se empuja por el socket.
    usePolling(() => {
        if (!serverId) return;
        membersService.listMembers(serverId)
            .then(setMembers)
            // Un servidor que ya no está lo resuelve quien lo carga.
            .catch(console.error);
    }, !!serverId);

    /**
     * Replaces the roles of one member in the list.
     *
     * The assignment endpoints answer 204 without a body, so the new state is
     * built here instead of being read back from a response.
     */
    const setMemberRoles = useCallback(
        (userId: string, roles: Role[]) =>
            setMembers(prev =>
                prev.map(member =>
                    member.user_id === userId
                        ? { ...member, roles: byPosition(roles) }
                        : member,
                ),
            ),
        [],
    );

    /**
     * Drops a banned member from the list (SCRUM-69).
     *
     * The poll would do it a few seconds later, but the row has to go the
     * moment the ban is confirmed: leaving it there invites a second ban of
     * someone who is no longer a member, which answers 404.
     */
    const removeMember = useCallback(
        (userId: string) => setMembers(prev => prev.filter(member => member.user_id !== userId)),
        [],
    );

    return { members, loading, setMemberRoles, removeMember };
};
