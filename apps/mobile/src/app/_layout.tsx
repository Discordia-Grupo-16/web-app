import '@/global.css';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@discordia/core';
import { mobileAuthStorage } from '@/shared/session/authStorage';
import { authService } from '@/shared/api';
import { sessionExpiry } from '@/shared/session/sessionExpiry';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider storage={mobileAuthStorage} onSignOut={authService.logout} sessionExpiry={sessionExpiry}>
        <Slot />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
