import { useCallback, useEffect, useState } from 'react';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';

export const useRoles = (serverId: string | undefined) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) return;
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const roleList = await rolesService.listRoles(serverId);
        if (isMounted) setRoles(roleList);
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

  const addRole = useCallback((role: Role) => setRoles(prev => [...prev, role]), []);

  const updateRole = useCallback(
    (role: Role) => setRoles(prev => prev.map(r => (r.id === role.id ? role : r))),
    [],
  );

  return { roles, loading, addRole, updateRole };
};
