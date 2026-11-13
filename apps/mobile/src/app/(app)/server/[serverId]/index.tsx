import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Channel, ServerMember } from '@discordia/api';
import {
  BAN_MEMBERS,
  KICK_MEMBERS,
  MANAGE_CHANNELS,
  MANAGE_ROLES,
  NONE,
  OWNERSHIP_TEXTS,
  PERMISSION_COPY,
  UNAVAILABLE_USER_NAME,
  VIEW_CHANNEL,
  hasPermission,
  rolesOfMember,
  useAuth,
  useOutgoingOwnershipTransfer,
  usePublicProfiles,
  useVoice,
  useServerVoiceRoster,
  useVoiceCallParticipants,
  useVoiceRosterViews,
  type RoleDeletionActor,
  type VoiceParticipant,
} from '@discordia/core';
import { voiceService } from '@/shared/api';
import { ChannelSection } from '@/features/channels';
import { InvitationsSection } from '@/features/invitations';
import { BansSection, MembersSection, useBans, useMembers } from '@/features/members';
import { dismissedRejections, OutgoingTransferNotice, TransferOwnershipDialog } from '@/features/ownership';
import { RolesSection, useRoles } from '@/features/roles';
import { ServerActions, useServerDetails } from '@/features/servers';
import { VoiceCallParticipantList, VoiceParticipantList } from '@/features/voice';
import { ownershipSource } from '@/shared/api';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

const NO_PARTICIPANTS: VoiceParticipant[] = [];

interface ProposeDialogProps {
  toUserId: string;
  serverName: string;
  transfer: ReturnType<typeof useOutgoingOwnershipTransfer>;
  onClose: () => void;
}

// Mounted only while proposing, so the recipient's profile is asked for only then.
function ProposeDialog({ toUserId, serverName, transfer, onClose }: ProposeDialogProps) {
  const profile = usePublicProfiles([toUserId]).get(toUserId);
  const toName = profile === undefined ? OWNERSHIP_TEXTS.loadingName : (profile?.name ?? UNAVAILABLE_USER_NAME);

  return (
    <TransferOwnershipDialog
      visible
      toName={toName}
      serverName={serverName}
      busy={transfer.busy === 'proposing'}
      error={transfer.error}
      onConfirm={async () => {
        if (await transfer.propose(toUserId)) onClose();
      }}
      onRetry={transfer.retry}
      onClose={() => {
        transfer.dismissError();
        onClose();
      }}
    />
  );
}

export default function ServerScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { user } = useAuth();
  const { server, loading: loadingServer, updateChannels, setLeaving } = useServerDetails(serverId);
  const router = useRouter();
  const {
    roles,
    loading: loadingRoles,
    addRole,
    updateRole,
    reload: reloadRoles,
    removeRole,
    replaceRoles,
  } = useRoles(serverId);
  const {
    members,
    loading: loadingMembers,
    setMemberRoles,
    removeMember,
    reload: reloadMembers,
  } = useMembers(serverId);

  // Leaving is not a permission but a condition: the owner cannot leave their own server, they
  // transfer it or delete it first. That is why this is still an ownership check and not a bit.
  // Up here because the ownership hook cannot go after the early return.
  const isOwner = !!user && server?.owner_id === user.id;

  // Only the owner transfers the ownership, whatever its permissions (SCRUM-35).
  const transfer = useOutgoingOwnershipTransfer({
    source: ownershipSource,
    dismissedRejections,
    serverId,
    isOwner,
  });
  useLiveRefresh({ resources: ['ownershipTransfers'], serverId, refresh: transfer.reload });
  const [proposingTo, setProposingTo] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const membersY = useRef(0);

  // The recipient left between opening the list and confirming: the list is out of date.
  const transferError = transfer.error?.kind;
  useEffect(() => {
    if (transferError === 'not-member') reloadMembers();
  }, [transferError, reloadMembers]);

  // Up here and not with the other permissions because a hook cannot go after the early return.
  // The same bit bans and revokes (ADR-0011); without it the hook does not even ask.
  const canBan = hasPermission(server?.my_permissions ?? NONE, BAN_MEMBERS);

  // Who deletes a role (SCRUM-64): their own roles come from their row in the member list. Up
  // here because a hook cannot go after the early return.
  const myPermissions = server?.my_permissions ?? NONE;
  const roleDeletionActor = useMemo<RoleDeletionActor>(
    () => ({ isOwner, permissions: myPermissions, roles: rolesOfMember(members, user?.id) }),
    [isOwner, myPermissions, members, user?.id],
  );
  const {
    bans,
    loading: loadingBans,
    error: bansError,
    removeBan,
    reload: reloadBans,
  } = useBans(serverId, canBan);
  const { call } = useVoice();
  const callChannelId = call.status === 'connected' ? call.channel.id : null;
  const callParticipants = useVoiceCallParticipants(call.status === 'connected' ? call.participants : NO_PARTICIPANTS);
  // Who is in the other voice channels, without being in the call (SCRUM-54). Without the server
  // loaded or without VIEW_CHANNEL (the backend answers 403) the hook gets no server and does not
  // ask. Coming back from the background needs nothing here: RealtimeProvider closes the socket
  // and reopens it, and the hook asks again on that reconnection.
  const roster = useServerVoiceRoster(
    server && hasPermission(server.my_permissions ?? NONE, VIEW_CHANNEL) ? serverId : undefined,
    voiceService.getServerVoiceParticipants,
  );
  const rosterViews = useVoiceRosterViews(roster);
  // The channel of the call shows LiveKit's list: it is instant and has the mute and who is speaking
  // (W14 and S7). The rest show the roster of `chat`, which does not know who is speaking, only when
  // someone is in it. Another server does not list the call's channel.
  const renderBelowChannel = (channel: Channel) => {
    if (channel.id === callChannelId) return <VoiceCallParticipantList participants={callParticipants} />;
    const connected = rosterViews.get(channel.id);
    return connected?.length ? <VoiceParticipantList participants={connected} /> : null;
  };

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

  const pending = transfer.view.kind === 'pending';
  const renderMemberActions = isOwner
    ? (member: ServerMember) =>
        member.user_id === user?.id ? null : (
          <TouchableOpacity
            onPress={() => setProposingTo(member.user_id)}
            disabled={pending}
            accessibilityLabel={OWNERSHIP_TEXTS.transfer}
            accessibilityState={{ disabled: pending }}
            className="pl-3"
            style={{ opacity: pending ? 0.5 : 1 }}
          >
            <Text className="text-[#7289da] text-xs">Transferir ›</Text>
          </TouchableOpacity>
        )
    : undefined;

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]" edges={['bottom']}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 12 }}>
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
          actor={roleDeletionActor}
          onRoleDeleted={roleId => {
            removeRole(roleId);
            // The role also leaves the roles of every member that had it.
            reloadMembers();
          }}
          onRolesReloaded={replaceRoles}
          onServerGone={() => router.back()}
        />
        <View onLayout={event => (membersY.current = event.nativeEvent.layout.y)}>
          <OutgoingTransferNotice
            view={transfer.view}
            busy={transfer.busy === 'cancelling'}
            onCancel={() => void transfer.cancel()}
            onDismissRejection={transfer.dismissRejection}
          />
          <MembersSection
            serverId={server.id}
            members={members}
            roles={roles}
            ownerId={server.owner_id}
            canManage={canManageRoles}
            canKick={hasPermission(permissions, KICK_MEMBERS)}
            canBan={canBan}
            onRolesChange={setMemberRoles}
            onMemberKicked={removeMember}
            onMemberBanned={userId => {
              removeMember(userId);
              // Without this the new ban would only show up with the next poll.
              reloadBans();
            }}
            renderMemberActions={renderMemberActions}
            onStale={() => {
              reloadRoles();
              reloadMembers();
            }}
          />
        </View>
        {/* Not part of the spinner above: the bans only start loading once the server says
            the caller has the bit, and showing the spinner a second time would blink the
            screen. The section waits on its own instead. */}
        {canBan && !loadingBans && (
          <BansSection
            serverId={server.id}
            bans={bans}
            error={bansError}
            onBanRevoked={removeBan}
          />
        )}
        <InvitationsSection serverId={server.id} canManage={isOwner} />
        <ServerActions
          server={server}
          isOwner={isOwner}
          onLeavingChange={setLeaving}
          pendingTransferTo={transfer.view.kind === 'pending' ? transfer.view.toName : null}
          onTransferRequested={() => scrollRef.current?.scrollTo({ y: membersY.current, animated: true })}
        />
      </ScrollView>
      {proposingTo && (
        <ProposeDialog
          toUserId={proposingTo}
          serverName={server.name}
          transfer={transfer}
          onClose={() => setProposingTo(null)}
        />
      )}
    </SafeAreaView>
  );
}
