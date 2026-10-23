import { useState } from 'react';
import { Modal, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { PERMISSION_COPY } from '@discordia/core';
import { getErrorDetail, type Role, type ServerMember } from '@discordia/api';
import { rolesService } from '@/shared/api';

interface Props {
  visible: boolean;
  serverId: string;
  member: ServerMember;
  memberName: string;
  roles: Role[];
  onClose: () => void;
  onRolesChange: (userId: string, roles: Role[]) => void;
}

/**
 * Gives and takes the roles of one member (SCRUM-62).
 *
 * Each switch is sent on its own instead of being collected behind a save
 * button: the API has one endpoint per role, both idempotent, and a button
 * would have to diff the two states and fire the same calls anyway — with the
 * added problem of a half-applied save if one of them is refused.
 */
export function MemberRolesModal({
  visible,
  serverId,
  member,
  memberName,
  roles,
  onClose,
  onRolesChange,
}: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const has = (roleId: string) => member.roles.some(role => role.id === roleId);

  const toggle = async (role: Role, enabled: boolean) => {
    setPending(role.id);
    setError(null);
    try {
      if (enabled) {
        await rolesService.assignRole(serverId, role.id, member.user_id);
        onRolesChange(member.user_id, [...member.roles, role]);
      } else {
        await rolesService.removeRole(serverId, role.id, member.user_id);
        onRolesChange(
          member.user_id,
          member.roles.filter(r => r.id !== role.id),
        );
      }
    } catch (err) {
      // The hierarchy is the backend's: it knows the roles of the caller and of the target,
      // and this screen does not. The list is left untouched, so the switch goes back to
      // what the server still holds.
      setError(getErrorDetail(err) || PERMISSION_COPY.memberRoleError);
    } finally {
      setPending(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">
            {PERMISSION_COPY.memberRolesTitle}
          </Text>
          <Text className="text-[#99aab5] text-sm mb-4">{memberName}</Text>

          {roles.length === 0 ? (
            <Text className="text-[#99aab5] text-sm">{PERMISSION_COPY.noRolesYet}</Text>
          ) : (
            <ScrollView className="max-h-80">
              {roles.map(role => (
                <View key={role.id} className="flex-row items-center gap-3 py-2">
                  <Text className="text-[#dcddde] text-sm flex-1">{role.name}</Text>
                  <Switch
                    value={has(role.id)}
                    disabled={pending !== null}
                    onValueChange={enabled => toggle(role, enabled)}
                    accessibilityLabel={role.name}
                    trackColor={{ true: '#7289da', false: '#72767d' }}
                  />
                </View>
              ))}
            </ScrollView>
          )}

          {error ? <Text className="text-[#ed4245] text-sm mt-3">{error}</Text> : null}

          <TouchableOpacity onPress={onClose} className="py-3 items-center mt-2">
            <Text className="text-[#99aab5]">Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
