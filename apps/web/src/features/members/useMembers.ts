import { useCallback, useEffect, useState } from 'react';
import type { Role, ServerMember } from '@discordia/api';
import { membersService } from '@/shared/api';

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

    /**
     * Replaces the roles of one member in the list.
     *
     * The assignment endpoints answer 204 without a body, so the new state is
     * built here instead of being read back from a response.
     */
    const setMemberRoles = useCallback(
        (userId: string, roles: Role[]) =>
            setMembers(prev =>
                prev.map(member => (member.user_id === userId ? { ...member, roles } : member)),
            ),
        [],
    );

    return { members, loading, setMemberRoles };
};
