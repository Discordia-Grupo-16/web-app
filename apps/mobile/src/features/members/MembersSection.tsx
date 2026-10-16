import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PERMISSION_COPY, authorView, useAuth, usePublicProfiles } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';
import { MemberRolesModal } from './MemberRolesModal';

interface MembersSectionProps {
  serverId: string;
  members: ServerMember[];
  roles: Role[];
  ownerId: string | undefined;
  canManage: boolean;
  onRolesChange: (userId: string, roles: Role[]) => void;
}

export function MembersSection({
  serverId,
  members,
  roles,
  ownerId,
  canManage,
  onRolesChange,
}: MembersSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

  // `community` only returns ids: the names are `identity`'s, resolved in one request.
  const profiles = usePublicProfiles(members.map(member => member.user_id));

  const nameOf = (userId: string) => authorView(userId, user, profiles.get(userId)).name;

  const editingMember = members.find(m => m.user_id === editing);

  return (
    <>
      <View className="flex-row items-center justify-between px-1 mt-2">
        <Text className="text-[#8e9297] text-xs font-semibold uppercase tracking-widest">
          {PERMISSION_COPY.membersTitle(members.length)}
        </Text>
      </View>

      {members.map(({ user_id, roles: memberRoles }) => {
        const isOwner = user_id === ownerId;
        // The highest role is the one that names the member in the list: it is the one the
        // backend's hierarchy uses, and the list comes ordered by position.
        const topRole = memberRoles.at(-1);

        return (
          <View
            key={user_id}
            className="bg-[#2c2f33] rounded-lg px-4 py-3 flex-row items-center"
          >
            {/* El nombre abre el perfil público, igual que en la web. El lápiz
                va aparte, para que las dos acciones no compitan por el mismo
                toque. */}
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/user/[userId]', params: { userId: user_id } })
              }
              className="flex-row items-center flex-1 min-w-0"
            >
              {isOwner && (
                <Text
                  className="text-[#faa61a] text-sm mr-1"
                  accessibilityLabel={PERMISSION_COPY.ownerMark}
                >
                  👑
                </Text>
              )}
              <Text className="text-[#dcddde] text-sm flex-1" numberOfLines={1}>
                {nameOf(user_id)}
              </Text>
              {topRole && <Text className="text-[#72767d] text-xs ml-2">{topRole.name}</Text>}
            </TouchableOpacity>

            {/* El dueño nunca es blanco: el backend lo rechaza, porque nadie está
                por encima suyo en la jerarquía. */}
            {canManage && !isOwner && (
              <TouchableOpacity
                onPress={() => setEditing(user_id)}
                accessibilityLabel={PERMISSION_COPY.editMemberRoles(nameOf(user_id))}
                className="pl-3"
              >
                <Text className="text-[#8e9297] text-xs">Roles ›</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {editingMember && (
        <MemberRolesModal
          visible
          serverId={serverId}
          member={editingMember}
          memberName={nameOf(editingMember.user_id)}
          roles={roles}
          onClose={() => setEditing(null)}
          onRolesChange={onRolesChange}
        />
      )}
    </>
  );
}
