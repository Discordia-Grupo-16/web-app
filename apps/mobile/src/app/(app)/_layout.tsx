import { useState } from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@discordia/core';
import type { User } from '@discordia/api';
import { ProfileButton } from '@/features/profile';
import { RealtimeProvider } from '@/features/chat';
import { buildAuthHref, LOGIN_ROUTE } from '@/features/auth';
import { VoiceBar, VoiceProvider } from '@/features/voice';

export default function AppLayout() {
  const { token, isLoading, user, signedOutByUser } = useAuth();
  const pathname = usePathname();
  // The screen the user was on while the session was open, or the one a link opened. Once the
  // session ends the router passes through other paths on its way to the login: those must not
  // replace it.
  const [destination, setDestination] = useState(pathname);
  if (token && destination !== pathname) setDestination(pathname);
  // The layout unmounts when the session ends, so a link opened later mounts it again with the flag
  // still set: only a session closed while this layout was on screen drops the destination.
  const [arrivedSignedOut] = useState(signedOutByUser);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator size="large" color="#7289da" />
      </View>
    );
  }

  if (!token) {
    // An invitation opened from a link, or a session that expired, comes back here after the login.
    // Closing the session on purpose does not leave a pending destination for the next login.
    const pending = signedOutByUser && !arrivedSignedOut ? null : destination;
    return <Redirect href={buildAuthHref(LOGIN_ROUTE, pending)} />;
  }

  return (
    <RealtimeProvider>
      <VoiceProvider>
        <View className="flex-1 bg-[#23272a]">
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
            <Stack.Screen name="invite/[code]" options={{ title: 'Invitación' }} />
            <Stack.Screen name="server/[serverId]/index" options={{ title: '' }} />
            <Stack.Screen name="server/[serverId]/channel/[channelId]" options={{ title: '' }} />
          </Stack>
          <VoiceBar />
        </View>
      </VoiceProvider>
    </RealtimeProvider>
  );
}
