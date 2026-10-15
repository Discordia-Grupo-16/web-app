import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import type { Channel } from '@discordia/api';
import { useAuth, useVoice, useVoiceCallParticipants, type VoiceParticipant } from '@discordia/core';
import { ChannelSection } from '@/features/channels';
import { InvitationsSection } from '@/features/invitations';
import { RolesSection, useRoles } from '@/features/roles';
import { ServerActions, useServerDetails } from '@/features/servers';
import { VoiceParticipantList } from '@/features/voice';

const NO_PARTICIPANTS: VoiceParticipant[] = [];

export default function ServerScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { user } = useAuth();
  const { server, loading: loadingServer, updateChannels, setLeaving } = useServerDetails(serverId);
  const { roles, loading: loadingRoles, addRole } = useRoles(serverId);

  const { call } = useVoice();
  const callChannelId = call.status === 'connected' ? call.channel.id : null;
  const callParticipants = useVoiceCallParticipants(call.status === 'connected' ? call.participants : NO_PARTICIPANTS);
  // Only the channel of the call shows who is in it. Another server does not list that channel.
  const renderBelowChannel = (channel: Channel) =>
    channel.id === callChannelId ? <VoiceParticipantList participants={callParticipants} /> : null;

  if (loadingServer || loadingRoles || !server) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator color="#7289da" />
      </View>
    );
  }

  const isOwner = !!user && server.owner_id === user.id;

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <ChannelSection
          serverId={server.id}
          channels={server.channels}
          canManage={isOwner}
          onChannelsChange={updateChannels}
          renderBelowChannel={renderBelowChannel}
        />
        <RolesSection serverId={server.id} roles={roles} canManage={isOwner} onRoleCreated={addRole} />
        <InvitationsSection serverId={server.id} canManage={isOwner} />
        <ServerActions server={server} isOwner={isOwner} onLeavingChange={setLeaving} />
      </ScrollView>
    </SafeAreaView>
  );
}
