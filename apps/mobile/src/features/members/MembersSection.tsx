import { useState, type ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PERMISSION_COPY, authorView, formatMutedUntil, useAuth, useMuteStatus, usePublicProfiles } from '@discordia/core';
import type { Role, ServerMember } from '@discordia/api';
import { BanMemberDialog } from './BanMemberDialog';
import { KickMemberDialog } from './KickMemberDialog';
import { MemberRolesModal } from './MemberRolesModal';
import { MuteMemberDialog } from './MuteMemberDialog';

interface MembersSectionProps {
  serverId: string;
  members: ServerMember[];
  roles: Role[];
  ownerId: string | undefined;
  canManage: boolean;
  canKick: boolean;
  canBan: boolean;
  /** MODERATE_MEMBERS, resolved by `community`. The backend checks it too: this only shows the button. */
  canModerate: boolean;
  onRolesChange: (userId: string, roles: Role[]) => void;
  onMemberKicked: (userId: string) => void;
  onMemberBanned: (userId: string) => void;
  /** A member was muted or unmuted: the list has to be read again (SCRUM-71). */
  onMuteChanged: () => void;
  /** Extra actions drawn at the end of each row, such as transferring the ownership. */
  renderMemberActions?: (member: ServerMember) => ReactNode;
  /** A 404 when giving or taking a role: the lists are out of date (SCRUM-64). */
  onStale?: () => void;
}

// Both read the clock through useMuteStatus: nothing arrives when a mute ends (SCRUM-71), so the mark
// and the meaning of the button have to turn off by themselves instead of waiting for the next read of the list.
function MutedBadge({ mutedUntil }: { mutedUntil: string | null }) {
  const { until } = useMuteStatus(mutedUntil);
  if (!until) return null;
  return <Text className="text-[#faa61a] text-xs">{PERMISSION_COPY.mutedBadge(formatMutedUntil(until))}</Text>;
}

function MuteButton({
  mutedUntil,
  memberName,
  onPress,
}: {
  mutedUntil: string | null;
  memberName: string;
  onPress: () => void;
}) {
  const { muted } = useMuteStatus(mutedUntil);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={muted ? PERMISSION_COPY.unmuteMember(memberName) : PERMISSION_COPY.muteMember(memberName)}
    >
      <Text className="text-[#faa61a] text-xs">{muted ? 'Levantar ›' : 'Silenciar ›'}</Text>
    </TouchableOpacity>
  );
}

export function MembersSection({
  serverId,
  members,
  roles,
  ownerId,
  canManage,
  canKick,
  canBan,
  canModerate,
  onRolesChange,
  onMemberKicked,
  onMemberBanned,
  onMuteChanged,
  renderMemberActions,
  onStale,
}: MembersSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [kicking, setKicking] = useState<string | null>(null);
  const [banning, setBanning] = useState<string | null>(null);
  const [muting, setMuting] = useState<string | null>(null);

  // `community` only returns ids: the names are `identity`'s, resolved in one request.
  const profiles = usePublicProfiles(members.map(member => member.user_id));

  const nameOf = (userId: string) => authorView(userId, user, profiles.get(userId)).name;

  const editingMember = members.find(m => m.user_id === editing);
  const mutingMember = members.find(m => m.user_id === muting);

  return (
    <>
      <View className="flex-row items-center justify-between px-1 mt-2">
        <Text className="text-[#8e9297] text-xs font-semibold uppercase tracking-widest">
          {PERMISSION_COPY.membersTitle(members.length)}
        </Text>
      </View>

      {members.map((rowMember) => {
        const { user_id, roles: memberRoles } = rowMember;
        const isOwner = user_id === ownerId;
        // The highest role is the one that names the member in the list: it is the one the
        // backend's hierarchy uses, and the list comes ordered by position.
        const topRole = memberRoles.at(-1);

        // Neither the owner nor oneself is a valid target for kick, ban or mute. A row with no
        // buttons at all does not draw the actions row, so it adds no empty space.
        const isOther = !isOwner && user_id !== user?.id;
        const showRoles = canManage && !isOwner;
        const showKick = canKick && isOther;
        const showBan = canBan && isOther;
        const showMute = canModerate && isOther;
        const extraActions = renderMemberActions?.(rowMember);
        const hasActions = showRoles || showKick || showBan || showMute || Boolean(extraActions);

        return (
          <View
            key={user_id}
            className="bg-[#2c2f33] rounded-lg px-4 py-3 gap-2"
          >
            {/* El nombre abre el perfil público, igual que en la web. El lápiz
                va aparte, para que las dos acciones no compitan por el mismo
                toque. */}
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/user/[userId]', params: { userId: user_id } })
              }
              className="min-w-0"
            >
              {/* Primera línea: el nombre se trunca solo si es muy largo; el rol no se corta. */}
              <View className="flex-row items-center">
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
              </View>
              {/* Segunda línea: la marca del silencio, sin cortar la hora. */}
              <MutedBadge mutedUntil={rowMember.muted_until} />
            </TouchableOpacity>

            {/* Los botones van abajo, en una fila que hace wrap si no entran. */}
            {hasActions && (
              <View testID={`member-actions-${user_id}`} className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
                {/* El dueño nunca es blanco: el backend lo rechaza, porque nadie está
                    por encima suyo en la jerarquía. */}
                {showRoles && (
                  <TouchableOpacity
                    onPress={() => setEditing(user_id)}
                    accessibilityLabel={PERMISSION_COPY.editMemberRoles(nameOf(user_id))}
                  >
                    <Text className="text-[#8e9297] text-xs">Roles ›</Text>
                  </TouchableOpacity>
                )}

                {/* Tampoco uno mismo: el backend lo rechaza, porque nadie está
                    estrictamente por encima de sí mismo. */}
                {showKick && (
                  <TouchableOpacity
                    onPress={() => setKicking(user_id)}
                    accessibilityLabel={PERMISSION_COPY.kickMember(nameOf(user_id))}
                  >
                    {/* Ámbar y no rojo: expulsar es menos grave que banear, y la web
                        lo distingue igual. */}
                    <Text className="text-[#faa61a] text-xs">Expulsar ›</Text>
                  </TouchableOpacity>
                )}

                {showBan && (
                  <TouchableOpacity
                    onPress={() => setBanning(user_id)}
                    accessibilityLabel={PERMISSION_COPY.banMember(nameOf(user_id))}
                  >
                    {/* Con la flecha como "Roles ›": las dos acciones de la fila abren
                        un modal, y el ícono de la web no tiene equivalente acá. */}
                    <Text className="text-[#ed4245] text-xs">Banear ›</Text>
                  </TouchableOpacity>
                )}

                {showMute && (
                  <MuteButton
                    mutedUntil={rowMember.muted_until}
                    memberName={nameOf(user_id)}
                    onPress={() => setMuting(user_id)}
                  />
                )}

                {extraActions}
              </View>
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
          onStale={onStale}
        />
      )}

      {kicking && (
        <KickMemberDialog
          visible
          serverId={serverId}
          userId={kicking}
          memberName={nameOf(kicking)}
          onClose={() => setKicking(null)}
          onKicked={onMemberKicked}
        />
      )}

      {mutingMember && (
        <MuteMemberDialog
          visible
          serverId={serverId}
          userId={mutingMember.user_id}
          memberName={nameOf(mutingMember.user_id)}
          mutedUntil={mutingMember.muted_until}
          onClose={() => setMuting(null)}
          onChanged={onMuteChanged}
        />
      )}

      {banning && (
        <BanMemberDialog
          visible
          serverId={serverId}
          userId={banning}
          memberName={nameOf(banning)}
          onClose={() => setBanning(null)}
          onBanned={onMemberBanned}
        />
      )}
    </>
  );
}
