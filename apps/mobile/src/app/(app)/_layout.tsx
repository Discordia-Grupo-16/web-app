import { Redirect, Stack } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@discordia/context';
import type { User } from '@discordia/types/auth';
import { ProfileButton } from '../../components/user/userProfileButton';
import { RealtimeProvider } from '@/realtime/RealtimeProvider';

export default function AppLayout() {
  const { token, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator size="large" color="#7289da" />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <RealtimeProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#2f3136' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#23272a' },
        }}
      >
        <Stack.Screen
          name="index"
          options={() => ({
            title: 'Discordia',
            headerRight: () => <ProfileButton user={user as User} />
          })}
        />
        <Stack.Screen name="join" options={{ title: 'Unirse a servidor' }} />
        <Stack.Screen name="server/[serverId]/index" options={{ title: '' }} />
        <Stack.Screen name="server/[serverId]/channel/[channelId]" options={{ title: '' }} />
      </Stack>
    </RealtimeProvider>
  );
}
