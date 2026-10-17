import { useCallback, useEffect, useState } from 'react';
import type { Role, ServerMember } from '@discordia/api';
import { membersService } from '@/shared/api';
import { useFocusedPolling } from '@/shared/hooks/useFocusedPolling';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) return;
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const list = await membersService.listMembers(serverId);
        if (isMounted) setMembers(list);
      } catch (err) {
        // A server that cannot be loaded is handled by whoever loads the server.
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [serverId]);

  // Quien entra al servidor después de que se cargó la lista no aparecía hasta
  // recargar, así que no se le podía asignar un rol.
  useFocusedPolling(() => {
    if (!serverId) return;
    membersService
      .listMembers(serverId)
      .then(setMembers)
      // Un servidor que ya no está lo resuelve quien lo carga.
      .catch(console.error);
  });

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
          member.user_id === userId ? { ...member, roles: byPosition(roles) } : member,
        ),
      ),
    [],
  );

  return { members, loading, setMemberRoles };
};
