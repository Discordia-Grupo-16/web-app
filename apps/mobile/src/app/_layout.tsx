import '@/global.css';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider, PublicProfilesProvider } from '@discordia/core';
import { mobileAuthStorage } from '@/shared/session/authStorage';
import { authService, userService } from '@/shared/api';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

// The public profile cache is per session: drop it before logging out.
const signOut = async () => {
  userService.clearPublicProfiles();
  await authService.logout();
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <AuthProvider storage={mobileAuthStorage} onSignOut={signOut}
          onVerifyMfa={authService.verifyMfa}
          sessionExpiry={sessionExpiry}>
          <PublicProfilesProvider source={userService}>
            <Slot />
          </PublicProfilesProvider>
          <StatusBar style="auto" />
        </AuthProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
