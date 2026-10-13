import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { PERMISSION_COPY } from '@discordia/core';
import type { Role } from '@discordia/api';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { CreateRoleModal } from './CreateRoleModal';
import { EditRolePermissionsModal } from './EditRolePermissionsModal';

interface RolesSectionProps {
  serverId: string;
  roles: Role[];
  canManage: boolean;
  onRoleCreated: (role: Role) => void;
  onRoleUpdated: (role: Role) => void;
}

export function RolesSection({
  serverId,
  roles,
  canManage,
  onRoleCreated,
  onRoleUpdated,
}: RolesSectionProps) {
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  return (
    <>
      <SectionHeader title="Roles" canManage={canManage} onAdd={() => setShowCreateRole(true)} />
      {roles.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">Sin roles creados.</Text>
      )}
      {roles.map(role =>
        canManage ? (
          <TouchableOpacity
            key={role.id}
            onPress={() => setEditingRole(role)}
            accessibilityLabel={PERMISSION_COPY.editRolePermissions(role.name)}
            className="bg-[#2c2f33] rounded-lg px-4 py-3 flex-row items-center justify-between"
          >
            <Text className="text-[#dcddde] text-sm">🛡 {role.name}</Text>
            <Text className="text-[#72767d] text-xs">Permisos ›</Text>
          </TouchableOpacity>
        ) : (
          <View key={role.id} className="bg-[#2c2f33] rounded-lg px-4 py-3">
            <Text className="text-[#dcddde] text-sm">🛡 {role.name}</Text>
          </View>
        ),
      )}

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
    </>
  );
}
