import { useState } from 'react';
import type { Role } from '@discordia/api';
import { CreateRoleModal } from './CreateRoleModal';
import { EditRolePermissionsModal } from './EditRolePermissionsModal';
import { RolesGroup } from './RolesGroup';

interface RolesSectionProps {
    serverId: string;
    roles: Role[];
    canManage: boolean;
    onRoleCreated: (role: Role) => void;
    onRoleUpdated: (role: Role) => void;
}

export const RolesSection = ({
    serverId,
    roles,
    canManage,
    onRoleCreated,
    onRoleUpdated,
}: RolesSectionProps) => {
    const [showCreateRole, setShowCreateRole] = useState(false);
    const [pendingEdit, setPendingEdit] = useState<Role | null>(null);

    const handleRoleCreated = (role: Role) => {
        onRoleCreated(role);
        setShowCreateRole(false);
    };

    const handleRoleUpdated = (role: Role) => {
        onRoleUpdated(role);
        setPendingEdit(null);
    };

    return (
        <>
            <RolesGroup
                roles={roles}
                canManage={canManage}
                onAdd={() => setShowCreateRole(true)}
                onEdit={setPendingEdit}
            />

            {showCreateRole && (
                <CreateRoleModal
                    serverId={serverId}
                    onClose={() => setShowCreateRole(false)}
                    onCreated={handleRoleCreated}
                />
            )}

            {pendingEdit && (
                <EditRolePermissionsModal
                    serverId={serverId}
                    role={pendingEdit}
                    onClose={() => setPendingEdit(null)}
                    onUpdated={handleRoleUpdated}
                />
            )}
        </>
    );
};
