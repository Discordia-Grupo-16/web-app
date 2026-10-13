import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@discordia/core';
import { ChannelSection } from '@/features/channels';
import { InvitationsSection } from '@/features/invitations';
import { RolesSection, useRoles } from '@/features/roles';
import { ServerActions, useServerDetails } from '@/features/servers';

export default function ServerScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const { user } = useAuth();
  const { server, loading: loadingServer, updateChannels, setLeaving } = useServerDetails(serverId);
  const { roles, loading: loadingRoles, addRole, updateRole } = useRoles(serverId);

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
        />
        <RolesSection
          serverId={server.id}
          roles={roles}
          canManage={isOwner}
          onRoleCreated={addRole}
          onRoleUpdated={updateRole}
        />
        <InvitationsSection serverId={server.id} canManage={isOwner} />
        <ServerActions server={server} isOwner={isOwner} onLeavingChange={setLeaving} />
      </ScrollView>
    </SafeAreaView>
  );
}
