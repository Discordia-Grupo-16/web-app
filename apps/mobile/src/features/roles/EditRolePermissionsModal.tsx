import { useState } from 'react';
import { Modal, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import {
  ADMINISTRATOR,
  PERMISSION_BY_NAME,
  PERMISSION_COPY,
  PERMISSION_HINT,
  PERMISSION_LABEL,
  PERMISSION_ORDER,
  hasPermission,
  togglePermission,
  toPermissionNames,
} from '@discordia/core';
import { getErrorDetail, type Role } from '@discordia/api';
import { rolesService } from '@/shared/api';

interface Props {
  visible: boolean;
  serverId: string;
  role: Role;
  onClose: () => void;
  onUpdated: (role: Role) => void;
}

export function EditRolePermissionsModal({ visible, serverId, role, onClose, onUpdated }: Props) {
  const [permissions, setPermissions] = useState(role.permissions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdministrator = hasPermission(permissions, ADMINISTRATOR);
  const unchanged = permissions === role.permissions;

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await rolesService.updateRolePermissions(
        serverId,
        role.id,
        toPermissionNames(permissions),
      );
      onUpdated(updated);
    } catch (err) {
      // The hierarchy lives in the backend: it knows which roles the caller has and this
      // screen does not, so a role above the caller's own is reported with its reason.
      setError(getErrorDetail(err) || PERMISSION_COPY.rolePermissionsError);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPermissions(role.permissions);
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">{PERMISSION_COPY.rolePermissionsTitle}</Text>
          <Text className="text-[#99aab5] text-sm mb-4">{role.name}</Text>

          <ScrollView className="max-h-80">
            {PERMISSION_ORDER.map(name => (
              <View key={name} className="flex-row items-center gap-3 py-2">
                <View className="flex-1">
                  <Text className="text-[#dcddde] text-sm">{PERMISSION_LABEL[name]}</Text>
                  <Text className="text-[#72767d] text-xs mt-0.5">{PERMISSION_HINT[name]}</Text>
                </View>
                <Switch
                  value={hasPermission(permissions, PERMISSION_BY_NAME[name])}
                  onValueChange={enabled =>
                    setPermissions(prev =>
                      togglePermission(prev, PERMISSION_BY_NAME[name], enabled),
                    )
                  }
                  accessibilityLabel={PERMISSION_LABEL[name]}
                  trackColor={{ true: '#7289da', false: '#72767d' }}
                />
              </View>
            ))}
          </ScrollView>

          {isAdministrator ? (
            <Text className="text-[#faa61a] text-xs mt-3">
              {PERMISSION_COPY.administratorNotice}
            </Text>
          ) : null}

          {error ? <Text className="text-[#ed4245] text-sm mt-3">{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || unchanged}
            accessibilityLabel={PERMISSION_COPY.save}
            className="bg-[#7289da] py-3 rounded-xl items-center mt-4 mb-2"
            style={{ opacity: loading || unchanged ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">
              {loading ? PERMISSION_COPY.saving : PERMISSION_COPY.save}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
