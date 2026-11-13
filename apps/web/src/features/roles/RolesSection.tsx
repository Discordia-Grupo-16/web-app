import { useState } from 'react';
import { NONE, canOfferRoleDeletion, useRoleDeletion, type RoleDeletionActor } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { CreateRoleModal } from './CreateRoleModal';
import { DeleteRoleDialog } from './DeleteRoleDialog';
import { EditRolePermissionsModal } from './EditRolePermissionsModal';
import { RoleMembersModal } from './RoleMembersModal';
import { RolesGroup } from './RolesGroup';

interface RolesSectionProps {
    serverId: string;
    roles: Role[];
    members: ServerMember[];
    ownerId: string | undefined;
    canManage: boolean;
    onRoleCreated: (role: Role) => void;
    onRoleUpdated: (role: Role) => void;
    /** Who deletes. Without it nothing offers "Eliminar". */
    actor?: RoleDeletionActor;
    onRoleDeleted?: (roleId: string) => void;
    onRolesReloaded?: (roles: Role[]) => void;
    onServerGone?: () => void;
}

const NOBODY: RoleDeletionActor = { isOwner: false, permissions: NONE, roles: [] };
const ignore = () => {};

export const RolesSection = ({
    serverId,
    roles,
    members,
    ownerId,
    canManage,
    onRoleCreated,
    onRoleUpdated,
    actor = NOBODY,
    onRoleDeleted = ignore,
    onRolesReloaded = ignore,
    onServerGone = ignore,
}: RolesSectionProps) => {
    const [showCreateRole, setShowCreateRole] = useState(false);
    const [pendingEdit, setPendingEdit] = useState<Role | null>(null);
    const [viewingMembers, setViewingMembers] = useState<Role | null>(null);
    const deletion = useRoleDeletion({
        source: rolesService,
        serverId,
        actor,
        roles,
        onDeleted: onRoleDeleted,
        onRolesReloaded,
        onServerGone,
    });
    // A modal open on a role that someone else deleted says so instead of acting on it.
    const isGone = (role: Role) => !roles.some(r => r.id === role.id);
    // A 404 from the role modal: the list is out of date. A server that is gone is handled by
    // whoever loads the server.
    const rereadRoles = () => {
        rolesService.listRoles(serverId).then(onRolesReloaded).catch(console.error);
    };

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
                onViewMembers={setViewingMembers}
                canDelete={role => canOfferRoleDeletion(role, actor)}
                onDelete={deletion.request}
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
                    roleGone={isGone(pendingEdit)}
                    onRoleGone={rereadRoles}
                />
            )}

            {viewingMembers && (
                <RoleMembersModal
                    role={viewingMembers}
                    members={members}
                    ownerId={ownerId}
                    onClose={() => setViewingMembers(null)}
                    roleGone={isGone(viewingMembers)}
                />
            )}

            {deletion.state.stage !== 'idle' && (
                <DeleteRoleDialog
                    state={deletion.state}
                    onConfirm={() => void deletion.confirm()}
                    onRetry={deletion.retry}
                    onClose={deletion.close}
                />
            )}
        </>
    );
};
