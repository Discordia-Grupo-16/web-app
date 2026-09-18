import '@/global.css';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@discordia/context';
import { mobileAuthStorage } from '@/services/auth-storage';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider storage={mobileAuthStorage}>
        <Slot />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
