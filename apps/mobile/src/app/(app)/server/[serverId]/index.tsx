import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import type { Channel } from '@discordia/api';
import {
  BAN_MEMBERS,
  KICK_MEMBERS,
  MANAGE_CHANNELS,
  MANAGE_ROLES,
  NONE,
  PERMISSION_COPY,
  VIEW_CHANNEL,
  hasPermission,
  useAuth,
  useVoice,
  useVoiceCallParticipants,
  type VoiceParticipant,
} from '@discordia/core';
import { ChannelSection } from '@/features/channels';
import { InvitationsSection } from '@/features/invitations';
import { MembersSection, useMembers } from '@/features/members';
import { RolesSection, useRoles } from '@/features/roles';
import { ServerActions, useServerDetails } from '@/features/servers';
import { VoiceParticipantList } from '@/features/voice';

const NO_PARTICIPANTS: VoiceParticipant[] = [];

export default function ServerScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { user } = useAuth();
  const { server, loading: loadingServer, updateChannels, setLeaving } = useServerDetails(serverId);
  const { roles, loading: loadingRoles, addRole, updateRole } = useRoles(serverId);
  const {
    members,
    loading: loadingMembers,
    setMemberRoles,
    removeMember,
  } = useMembers(serverId);

  const { call } = useVoice();
  const callChannelId = call.status === 'connected' ? call.channel.id : null;
  const callParticipants = useVoiceCallParticipants(call.status === 'connected' ? call.participants : NO_PARTICIPANTS);
  // Only the channel of the call shows who is in it. Another server does not list that channel.
  const renderBelowChannel = (channel: Channel) =>
    channel.id === callChannelId ? <VoiceParticipantList participants={callParticipants} /> : null;

  if (loadingServer || loadingRoles || loadingMembers || !server) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator color="#7289da" />
      </View>
    );
  }

  // What the caller can do comes resolved from `community` (ADR-0011).
  const permissions = server.my_permissions ?? NONE;
  const canManageChannels = hasPermission(permissions, MANAGE_CHANNELS);
  const canManageRoles = hasPermission(permissions, MANAGE_ROLES);

  // Leaving is not a permission but a condition: the owner cannot leave their own server, they
  // delete it. That is why this is still an ownership check and not a bit.
  const isOwner = !!user && server.owner_id === user.id;

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {hasPermission(permissions, VIEW_CHANNEL) ? (
          <ChannelSection
            serverId={server.id}
            channels={server.channels}
            canManage={canManageChannels}
            onChannelsChange={updateChannels}
            renderBelowChannel={renderBelowChannel}
          />
        ) : (
          // `community` no manda los canales sin VIEW_CHANNEL, así que la
          // sección quedaría vacía sin explicar nada.
          <Text className="text-[#99aab5] text-xs px-1">{PERMISSION_COPY.noViewChannel}</Text>
        )}
        <RolesSection
          serverId={server.id}
          roles={roles}
          members={members}
          ownerId={server.owner_id}
          canManage={canManageRoles}
          onRoleCreated={addRole}
          onRoleUpdated={updateRole}
        />
        <MembersSection
          serverId={server.id}
          members={members}
          roles={roles}
          ownerId={server.owner_id}
          canManage={canManageRoles}
          canKick={hasPermission(permissions, KICK_MEMBERS)}
          canBan={hasPermission(permissions, BAN_MEMBERS)}
          onRolesChange={setMemberRoles}
          onMemberKicked={removeMember}
          onMemberBanned={removeMember}
        />
        <InvitationsSection serverId={server.id} canManage={isOwner} />
        <ServerActions server={server} isOwner={isOwner} onLeavingChange={setLeaving} />
      </ScrollView>
    </SafeAreaView>
  );
}
