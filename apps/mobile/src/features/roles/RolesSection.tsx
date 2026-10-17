import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { PERMISSION_COPY } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { CreateRoleModal } from './CreateRoleModal';
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
}

export function RolesSection({
  serverId,
  roles,
  members,
  ownerId,
  canManage,
  onRoleCreated,
  onRoleUpdated,
}: RolesSectionProps) {
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [viewingMembers, setViewingMembers] = useState<Role | null>(null);

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
        />
      )}

      {viewingMembers && (
        <RoleMembersModal
          visible
          role={viewingMembers}
          members={members}
          ownerId={ownerId}
          onClose={() => setViewingMembers(null)}
        />
      )}
    </>
  );
}
