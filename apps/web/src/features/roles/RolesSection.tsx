import { useState } from 'react';
import type { Role } from '@discordia/api';
import { CreateRoleModal } from './CreateRoleModal';
import { RolesGroup } from './RolesGroup';

interface RolesSectionProps {
    serverId: string;
    roles: Role[];
    canManage: boolean;
    onRoleCreated: (role: Role) => void;
}

export const RolesSection = ({ serverId, roles, canManage, onRoleCreated }: RolesSectionProps) => {
    const [showCreateRole, setShowCreateRole] = useState(false);

    const handleRoleCreated = (role: Role) => {
        onRoleCreated(role);
        setShowCreateRole(false);
    };

    return (
        <>
            <RolesGroup roles={roles} canManage={canManage} onAdd={() => setShowCreateRole(true)} />

            {showCreateRole && (
                <CreateRoleModal
                    serverId={serverId}
                    onClose={() => setShowCreateRole(false)}
                    onCreated={handleRoleCreated}
                />
            )}
        </>
    );
};
