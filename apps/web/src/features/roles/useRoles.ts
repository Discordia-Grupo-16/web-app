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

    /**
     * Relee los roles después de crear uno.
     *
     * No alcanza con agregarlo al arreglo local: un rol nuevo nace abajo de la
     * jerarquía y empuja un lugar a todos los demás, así que las posiciones que
     * tiene el cliente quedan viejas (ADR-0001 de `community`). Replicar ese
     * corrimiento acá sería reimplementar una regla del backend.
     */
    const addRole = useCallback(() => {
        if (!serverId) return;
        rolesService
            .listRoles(serverId)
            .then(setRoles)
            // Un servidor que ya no está lo resuelve quien lo carga.
            .catch(console.error);
    }, [serverId]);

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
