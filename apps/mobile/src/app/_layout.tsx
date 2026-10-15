import '@/global.css';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, PublicProfilesProvider } from '@discordia/core';
import { mobileAuthStorage } from '@/shared/session/authStorage';
import { authService, userService } from '@/shared/api';

// The public profile cache is per session: drop it before logging out.
const signOut = async () => {
  userService.clearPublicProfiles();
  await authService.logout();
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider storage={mobileAuthStorage} onSignOut={signOut}>
        <PublicProfilesProvider source={userService}>
          <Slot />
        </PublicProfilesProvider>
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
