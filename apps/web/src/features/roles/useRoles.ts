import { useCallback, useEffect, useState } from 'react';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';

export const useRoles = (serverId: string | undefined) => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadRoles = async () => {
            if (!serverId) {
                setRoles([]);
                return;
            }

            setLoading(true);
            try {
                const roleList = await rolesService.listRoles(serverId);
                if (isMounted) setRoles(roleList);
            } catch (err) {
                // A server that is gone is handled by whoever loads the server.
                console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadRoles();

        return () => {
            isMounted = false;
        };
    }, [serverId]);

    const addRole = useCallback((role: Role) => setRoles(prev => [...prev, role]), []);

    const updateRole = useCallback(
        (role: Role) =>
            setRoles(prev =>
                prev.map(r => {
                    if (r.id === role.id) return role;
                    // El backend desmarca el anterior en la misma transacción.
                    // Sin replicarlo acá quedan dos insignias "Por defecto"
                    // hasta recargar.
                    return role.is_default ? { ...r, is_default: false } : r;
                }),
            ),
        [],
    );

    return { roles, loading, addRole, updateRole };
};
