import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  NONE,
  PERMISSION_COPY,
  ROLE_DELETION_TEXTS,
  canOfferRoleDeletion,
  useRoleDeletion,
  type RoleDeletionActor,
} from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { CreateRoleModal } from './CreateRoleModal';
import { DeleteRoleDialog } from './DeleteRoleDialog';
import { EditRolePermissionsModal } from './EditRolePermissionsModal';
import { RoleMembersModal } from './RoleMembersModal';

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

export function RolesSection({
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
}: RolesSectionProps) {
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
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

  return (
    <>
      <SectionHeader title="Roles" canManage={canManage} onAdd={() => setShowCreateRole(true)} />
      {roles.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">Sin roles creados.</Text>
      )}
      {roles.map(role => (
        <View
          key={role.id}
          className="bg-[#2c2f33] rounded-lg px-4 py-3 flex-row items-center"
        >
          <Text className="text-[#dcddde] text-sm flex-1" numberOfLines={1}>
            🛡 {role.name}
            {role.is_default ? (
              <Text className="text-[#72767d] text-xs"> · {PERMISSION_COPY.defaultRoleBadge}</Text>
            ) : null}
          </Text>

          {/* Dos acciones por fila, como en la lista de miembros. Antes el
              nombre entero abría los permisos, y eso no deja lugar para la
              segunda sin que las dos compitan por el mismo toque. */}
          {canManage && (
            <TouchableOpacity
              onPress={() => setViewingMembers(role)}
              accessibilityLabel={PERMISSION_COPY.viewRoleMembers(role.name)}
              className="pl-3"
            >
              <Text className="text-[#72767d] text-xs">Miembros ›</Text>
            </TouchableOpacity>
          )}

          {canManage && (
            <TouchableOpacity
              onPress={() => setEditingRole(role)}
              accessibilityLabel={PERMISSION_COPY.editRolePermissions(role.name)}
              className="pl-3"
            >
              <Text className="text-[#72767d] text-xs">Permisos ›</Text>
            </TouchableOpacity>
          )}

          {canOfferRoleDeletion(role, actor) && (
            <TouchableOpacity
              onPress={() => deletion.request(role)}
              accessibilityLabel={ROLE_DELETION_TEXTS.actionLabel(role.name)}
              className="pl-3"
            >
              <Text className="text-[#ed4245] text-xs">{ROLE_DELETION_TEXTS.action} ›</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <CreateRoleModal
        visible={showCreateRole}
        serverId={serverId}
        onClose={() => setShowCreateRole(false)}
        onCreated={role => { onRoleCreated(role); setShowCreateRole(false); }}
      />

      {editingRole && (
        <EditRolePermissionsModal
          visible
          serverId={serverId}
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onUpdated={role => { onRoleUpdated(role); setEditingRole(null); }}
          roleGone={isGone(editingRole)}
          onRoleGone={rereadRoles}
        />
      )}

      {viewingMembers && (
        <RoleMembersModal
          visible
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
}
