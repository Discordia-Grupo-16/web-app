import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { PERMISSION_COPY, authorView, useAuth, usePublicProfiles } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';

interface Props {
  visible: boolean;
  role: Role;
  members: ServerMember[];
  ownerId: string | undefined;
  onClose: () => void;
}

/**
 * Lists who holds a role (SCRUM-67).
 *
 * It filters the member list already loaded instead of asking the backend:
 * every member arrives with their roles, so there is nothing to fetch and no
 * second source of truth to keep in step.
 */
export function RoleMembersModal({ visible, role, members, ownerId, onClose }: Props) {
  const { user } = useAuth();
  const withRole = members.filter(member => member.roles.some(r => r.id === role.id));

  // `community` only returns ids: the names are `identity`'s, resolved in one request.
  const profiles = usePublicProfiles(withRole.map(member => member.user_id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">
            {PERMISSION_COPY.roleMembersTitle}
          </Text>
          <Text className="text-[#99aab5] text-sm mb-4">
            {role.name} · {PERMISSION_COPY.membersTitle(withRole.length)}
          </Text>

          {withRole.length === 0 ? (
            <Text className="text-[#99aab5] text-sm">{PERMISSION_COPY.noMembersWithRole}</Text>
          ) : (
            <ScrollView className="max-h-80">
              {withRole.map(({ user_id }) => (
                <View key={user_id} className="flex-row items-center py-2">
                  {user_id === ownerId && (
                    <Text
                      className="text-[#faa61a] text-sm mr-1"
                      accessibilityLabel={PERMISSION_COPY.ownerMark}
                    >
                      👑
                    </Text>
                  )}
                  <Text className="text-[#dcddde] text-sm flex-1" numberOfLines={1}>
                    {authorView(user_id, user, profiles.get(user_id)).name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity onPress={onClose} className="py-3 items-center mt-2">
            <Text className="text-[#99aab5]">Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
