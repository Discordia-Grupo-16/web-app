import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Role } from '@discordia/api';
import { SectionHeader } from '@/shared/ui/SectionHeader';
import { CreateRoleModal } from './CreateRoleModal';

interface RolesSectionProps {
  serverId: string;
  roles: Role[];
  canManage: boolean;
  onRoleCreated: (role: Role) => void;
}

export function RolesSection({ serverId, roles, canManage, onRoleCreated }: RolesSectionProps) {
  const [showCreateRole, setShowCreateRole] = useState(false);

  return (
    <>
      <SectionHeader title="Roles" canManage={canManage} onAdd={() => setShowCreateRole(true)} />
      {roles.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">Sin roles creados.</Text>
      )}
      {roles.map(role => (
        <View key={role.id} className="bg-[#2c2f33] rounded-lg px-4 py-3">
          <Text className="text-[#dcddde] text-sm">🛡 {role.name}</Text>
        </View>
      ))}

      <CreateRoleModal
        visible={showCreateRole}
        serverId={serverId}
        onClose={() => setShowCreateRole(false)}
        onCreated={role => { onRoleCreated(role); setShowCreateRole(false); }}
      />
    </>
  );
}
