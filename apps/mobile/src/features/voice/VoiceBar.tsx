import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canRejoin, useVoice, VOICE_DISCONNECT_TEXTS, VOICE_TEXTS } from '@discordia/core';
import { MicIcon } from './MicIcon';
import { MicOffIcon } from './MicOffIcon';
import { PhoneOffIcon } from './PhoneOffIcon';

// The way back to the call, and out of it, from any screen, including another server.
export const VoiceBar = () => {
  const { call, attempt, rejoin, leave, toggleMute, dismiss } = useVoice();
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
        <View className="flex-1 items-start gap-2">
          <Text accessibilityRole="alert" className="text-xs text-[#dcddde]">
            {VOICE_DISCONNECT_TEXTS[call.reason]}
          </Text>
          {canRejoin(call.reason) && (
            <Pressable
              accessibilityRole="button"
              onPress={rejoin}
              className="rounded bg-[#3ba55d] px-3 py-1.5"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-xs font-semibold text-white">{VOICE_TEXTS.rejoin}</Text>
            </Pressable>
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" onPress={dismiss} hitSlop={12}>
          <Text className="text-sm text-[#b9bbbe]">✕</Text>
        </Pressable>
      </View>
    );
  }

  const { channel } = call;
  // Leaving does not cancel a join in progress: the button waits until it ends.
  const joining = attempt?.status === 'connecting';
  const noMic = !call.micAvailable;
  const micDisabled = call.micPending || joining;
  const micColor = noMic ? '#faa61a' : call.muted ? '#ed4245' : '#b9bbbe';

  return (
    <View
      className="flex-row items-center gap-3 border-t border-[#202225] bg-[#292b2f] px-4 pt-2"
      style={barStyle}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${VOICE_TEXTS.connectedTo} ${channel.name}`}
        accessibilityHint="Abre la llamada"
        onPress={() =>
          router.push({
            pathname: '/server/[serverId]/channel/[channelId]',
            params: { serverId: channel.serverId, channelId: channel.id, name: channel.name, type: 'voice' },
          })
        }
        className="flex-1"
      >
        <Text className={`text-xs font-semibold ${call.reconnecting ? 'text-[#faa61a]' : 'text-[#3ba55d]'}`}>
          {call.reconnecting ? VOICE_TEXTS.reconnecting : VOICE_TEXTS.connectedTo}
        </Text>
        <Text numberOfLines={1} className="text-xs text-[#b9bbbe]">
          {channel.name}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={call.muted ? VOICE_TEXTS.unmute : VOICE_TEXTS.mute}
        accessibilityHint={noMic ? VOICE_TEXTS.noMic : undefined}
        accessibilityState={{ selected: call.muted, disabled: micDisabled, busy: call.micPending }}
        disabled={micDisabled}
        onPress={toggleMute}
        hitSlop={8}
        className="rounded-full p-2"
        style={({ pressed }) => ({ opacity: micDisabled ? 0.4 : 1, backgroundColor: pressed ? '#ffffff1a' : 'transparent' })}
      >
        {call.muted ? <MicOffIcon size={20} color={micColor} /> : <MicIcon color={micColor} />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={VOICE_TEXTS.leave}
        accessibilityState={{ disabled: joining }}
        disabled={joining}
        onPress={leave}
        hitSlop={8}
        className="rounded-full p-2"
        style={({ pressed }) => ({ opacity: joining ? 0.4 : 1, backgroundColor: pressed ? '#ed424526' : 'transparent' })}
      >
        <PhoneOffIcon />
      </Pressable>
    </View>
  );
};
