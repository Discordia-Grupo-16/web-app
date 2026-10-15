import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { UNAVAILABLE_USER_NAME, useAuth, usePublicProfile } from '@discordia/core';
import { useCommonServers } from '../useCommonServers';

const Avatar = ({ name, avatarUrl }: { name: string; avatarUrl: string | null }) => (
  <View className="w-[88px] h-[88px] rounded-full bg-[#7289da] items-center justify-center overflow-hidden">
    {avatarUrl ? (
      <Image source={{ uri: avatarUrl }} accessibilityLabel={name} className="w-full h-full" />
    ) : (
      <Text className="text-white text-3xl font-bold">{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    )}
  </View>
);

const SectionTitle = ({ children }: { children: string }) => (
  <Text className="text-[#72767d] text-xs font-bold uppercase tracking-wider mb-1">{children}</Text>
);

const RetryButton = ({ onRetry }: { onRetry: () => void }) => (
  <TouchableOpacity accessibilityLabel="Reintentar" onPress={onRetry} className="py-1 self-start">
    <Text className="text-[#7289da] text-sm font-semibold underline">Reintentar</Text>
  </TouchableOpacity>
);

const CommonServers = ({ userId }: { userId: string }) => {
  const { state, retry } = useCommonServers(userId);

  return (
    <View>
      <View className="h-[1px] bg-white/10 mb-3" />
      <SectionTitle>Servidores en común</SectionTitle>
      {state.status === 'loading' && <Text className="text-sm text-[#99aab5]">Cargando...</Text>}
      {state.status === 'error' && (
        <View>
          <Text className="text-sm text-[#ed4245]">No pudimos cargar los servidores en común.</Text>
          <RetryButton onRetry={retry} />
        </View>
      )}
      {state.status === 'ready' && state.servers.length === 0 && (
        <Text className="text-sm text-[#99aab5]">No tienen servidores en común.</Text>
      )}
      {state.status === 'ready' &&
        state.servers.map((server) => (
          <View key={server.id} className="flex-row items-center py-1">
            <View className="w-6 h-6 rounded-full bg-[#5b6eae] items-center justify-center overflow-hidden mr-2">
              {server.avatar_url ? (
                <Image source={{ uri: server.avatar_url }} className="w-full h-full" />
              ) : (
                <Text className="text-white text-xs font-bold">{(server.name.trim()[0] ?? '?').toUpperCase()}</Text>
              )}
            </View>
            <Text className="flex-1 text-sm text-[#dcddde]" numberOfLines={1}>{server.name}</Text>
          </View>
        ))}
    </View>
  );
};

// Public profile of another user: only public data (name, photo, bio) and the servers in common.
// The activity status is not shown: it depends on the optional presence story (#37).
export function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const { state, retry } = usePublicProfile(userId);
  const isOwnProfile = user?.id === userId;

  return (
    <ScrollView className="flex-1 bg-[#23272a]">
      <Stack.Screen options={{ title: 'Perfil', headerStyle: { backgroundColor: '#18191c' } }} />

      <View className="m-4 rounded-2xl bg-[#18191c] p-4" style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
        {state.status === 'loading' && (
          <View className="items-center py-6">
            <ActivityIndicator color="#7289da" />
            <Text className="text-sm text-[#99aab5] mt-2">Cargando perfil...</Text>
          </View>
        )}

        {state.status === 'error' && (
          <View>
            <Text className="text-sm text-[#ed4245]">No pudimos cargar el perfil.</Text>
            <RetryButton onRetry={retry} />
          </View>
        )}

        {state.status === 'ready' && state.profile === null && (
          <View className="items-center py-4">
            <Avatar name="?" avatarUrl={null} />
            <Text className="text-white text-xl font-bold mt-3">{UNAVAILABLE_USER_NAME}</Text>
            <Text className="text-sm text-[#99aab5] mt-1">El perfil no está disponible</Text>
          </View>
        )}

        {state.status === 'ready' && state.profile && (
          <View>
            <View className="items-center mb-4">
              <Avatar name={state.profile.name} avatarUrl={state.profile.avatarUrl} />
              <Text className="text-white text-xl font-bold mt-3 text-center">{state.profile.name}</Text>
            </View>
            {state.profile.bio && (
              <View className="mb-4">
                <View className="h-[1px] bg-white/10 mb-3" />
                <SectionTitle>Sobre mí</SectionTitle>
                <Text className="text-[#dcddde] text-sm leading-5">{state.profile.bio}</Text>
              </View>
            )}
            {!isOwnProfile && <CommonServers userId={userId} />}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
