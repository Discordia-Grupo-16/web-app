import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoice, VOICE_DISCONNECT_TEXTS } from '@discordia/core';

// The way back to the call from any screen, including another server.
export const VoiceBar = () => {
  const { call, dismiss } = useVoice();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  if (call.status === 'idle') return null;

  const barStyle = { paddingBottom: bottom + 8 };

  if (call.status === 'disconnected') {
    return (
      <View
        className="flex-row items-start gap-2 border-t border-[#202225] bg-[#292b2f] px-4 pt-2"
        style={barStyle}
      >
        <Text accessibilityRole="alert" className="flex-1 text-xs text-[#dcddde]">
          {VOICE_DISCONNECT_TEXTS[call.reason]}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={dismiss} hitSlop={12}>
          <Text className="text-sm text-[#b9bbbe]">✕</Text>
        </Pressable>
      </View>
    );
  }

  const { channel } = call;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="Abre la llamada"
      onPress={() =>
        router.push({
          pathname: '/server/[serverId]/channel/[channelId]',
          params: { serverId: channel.serverId, channelId: channel.id, name: channel.name, type: 'voice' },
        })
      }
      className="border-t border-[#202225] bg-[#292b2f] px-4 pt-2"
      style={barStyle}
    >
      <Text className="text-xs font-semibold text-[#3ba55d]">Conectado a</Text>
      <Text numberOfLines={1} className="text-xs text-[#b9bbbe]">
        {channel.name}
      </Text>
    </Pressable>
  );
};
