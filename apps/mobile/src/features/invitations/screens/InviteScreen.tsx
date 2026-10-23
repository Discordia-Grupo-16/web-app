import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { invitationErrorMessage, parseInviteCode } from '@discordia/core';
import { invitationsService } from '@/shared/api';

const INVALID_CODE_MESSAGE = 'El link de invitación no es válido.';

/**
 * Landing of the `discordia://invite/<code>` deep link. Like the web `InvitePage`, it joins the
 * server on its own: on success it opens the server, on failure it explains why. Without a session
 * the app layout sends the user through the login first and brings them back here.
 */
export function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  // The route param comes from a link anyone can craft: it must look like a code before it is sent.
  const inviteCode = parseInviteCode((Array.isArray(code) ? code[0] : code) ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(inviteCode ? null : INVALID_CODE_MESSAGE);
  // The router object is not guaranteed to be stable: joining must not depend on it.
  const routerRef = useRef(router);
  const joinedCode = useRef<string | null>(null);
  // A join already sent stays done in the backend: if the user left meanwhile, the answer must not
  // pull them out of the screen they went to.
  const mounted = useRef(false);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!inviteCode || joinedCode.current === inviteCode) return;
    joinedCode.current = inviteCode;
    invitationsService
      .joinServer(inviteCode)
      .then((member) => {
        if (mounted.current) routerRef.current.replace(`/server/${member.server_id}`);
      })
      .catch((err) => {
        if (mounted.current) setErrorMsg(invitationErrorMessage(err?.response?.status));
      });
  }, [inviteCode]);

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
            onPress={() => routerRef.current.replace('/')}
            className="bg-[#4f545c] px-6 py-3 rounded-xl"
          >
            <Text className="text-[#dcddde] font-bold">Ir al inicio</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
