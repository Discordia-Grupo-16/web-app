import '@/global.css';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@discordia/core';
import { mobileAuthStorage } from '@/services/auth-storage';
import { authService } from '@/services/auth-service';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider storage={mobileAuthStorage} onSignOut={authService.logout}>
        <Slot />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
