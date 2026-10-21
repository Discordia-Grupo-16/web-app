import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { invitationErrorMessage } from '@discordia/core';
import { invitationsService } from '@/shared/api';

/**
 * Landing of the `discordia://invite/<code>` deep link. Like the web `InvitePage`, it joins the
 * server on its own: on success it opens the server, on failure it explains why. Without a session
 * the app layout sends the user through the login first and brings them back here.
 */
export function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const inviteCode = Array.isArray(code) ? code[0] : code;
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode) return;
    let active = true;
    invitationsService
      .joinServer(inviteCode)
      .then((member) => {
        if (active) router.replace(`/server/${member.server_id}`);
      })
      .catch((err) => {
        if (active) setErrorMsg(invitationErrorMessage(err?.response?.status));
      });
    return () => {
      active = false;
    };
  }, [inviteCode, router]);

  return (
    <SafeAreaView className="flex-1 bg-[#23272a] items-center justify-center px-6" edges={['bottom']}>
      {errorMsg === null ? (
        <View className="items-center">
          <ActivityIndicator size="large" color="#7289da" />
          <Text className="text-white font-semibold mt-4">Procesando invitación…</Text>
        </View>
      ) : (
        <View className="items-center">
          <View className="w-16 h-16 rounded-full items-center justify-center mb-4 bg-[#ed4245]">
            <Text className="text-white text-2xl font-bold">✕</Text>
          </View>
          <Text className="text-white font-black text-xl mb-2">Invitación inválida</Text>
          <Text className="text-[#99aab5] text-sm text-center mb-6">{errorMsg}</Text>
          <TouchableOpacity
            onPress={() => router.replace('/')}
            className="bg-[#4f545c] px-6 py-3 rounded-xl"
          >
            <Text className="text-[#dcddde] font-bold">Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
