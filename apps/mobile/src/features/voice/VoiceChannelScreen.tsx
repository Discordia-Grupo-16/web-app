import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import {
  isRetryableJoinError,
  useVoice,
  useVoiceCallParticipants,
  VOICE_JOIN_ERROR_TEXTS,
  VOICE_TEXTS,
  type VoiceChannelRef,
  type VoiceParticipant,
} from '@discordia/core';
import { MicOffIcon } from './MicOffIcon';
import { VoiceParticipantList } from './VoiceParticipantList';

const NO_PARTICIPANTS: VoiceParticipant[] = [];

// Voice runs on native WebRTC modules that only exist in the development build, not in Expo Go.
export const VOICE_NEEDS_DEV_BUILD = 'La voz necesita la app de desarrollo.';

const Button = ({ label, onPress, color, busy }: { label: string; onPress: () => void; color: string; busy?: boolean }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ busy: !!busy, disabled: !!busy }}
    disabled={busy}
    onPress={onPress}
    className="flex-row items-center gap-2 rounded-md px-6 py-3"
    style={({ pressed }) => ({ backgroundColor: color, opacity: pressed ? 0.8 : 1 })}
  >
    {busy && <ActivityIndicator size="small" color="#ffffff" />}
    <Text className="text-white text-sm font-semibold">{label}</Text>
  </Pressable>
);

// canJoin comes from the server permissions. Without it there is no "Unirse"; a call already going
// on in this channel is still shown, because cutting it is the server's job.
export const VoiceChannelScreen = ({ channel, canJoin }: { channel: VoiceChannelRef; canJoin: boolean }) => {
  const { call, attempt, available, join, retry } = useVoice();
  const inCall = call.status === 'connected' && call.channel.id === channel.id;
  const participants = useVoiceCallParticipants(inCall ? call.participants : NO_PARTICIPANTS);
  const ownAttempt = attempt?.channel.id === channel.id ? attempt : null;

  if (inCall) {
    return (
      <ScrollView className="flex-1 bg-[#23272a]" contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text className="text-sm font-semibold text-[#3ba55d]">Estás en la llamada</Text>
        {!call.micAvailable && (
          <View className="flex-row gap-3 rounded-md bg-[#3a3d43] p-3">
            <MicOffIcon size={18} color="#faa61a" />
            <View className="flex-1 gap-2">
              <Text accessibilityRole="alert" className="text-sm text-[#dcddde]">
                {VOICE_TEXTS.noMic}
              </Text>
              {call.micBlocked && (
                <>
                  <Text className="text-sm text-[#b9bbbe]">{VOICE_TEXTS.micBlockedMobile}</Text>
                  <Text className="text-xs text-[#b9bbbe]">{VOICE_TEXTS.micBlockedMobileInCall}</Text>
                  <View className="items-start">
                    <Button label={VOICE_TEXTS.openSettings} color="#4f545c" onPress={() => void Linking.openSettings()} />
                  </View>
                </>
              )}
            </View>
          </View>
        )}
        <VoiceParticipantList participants={participants} variant="roomy" />
      </ScrollView>
    );
  }

  const connecting = ownAttempt?.status === 'connecting';
  const failed = ownAttempt?.status === 'failed' ? ownAttempt : null;

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-[#23272a] px-6">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-[#2f3136]">
        <Text className="text-4xl">🔊</Text>
      </View>
      <Text className="text-xl font-bold text-white">{channel.name}</Text>

      {!available ? (
        <Text className="text-center text-sm text-[#b9bbbe]">{VOICE_NEEDS_DEV_BUILD}</Text>
      ) : !canJoin ? (
        <Text className="text-center text-sm text-[#b9bbbe]">{VOICE_JOIN_ERROR_TEXTS.forbidden}</Text>
      ) : failed ? (
        <>
          <Text accessibilityRole="alert" className="text-center text-sm text-[#f38688]">
            {VOICE_JOIN_ERROR_TEXTS[failed.error]}
          </Text>
          {isRetryableJoinError(failed.error) && <Button label="Reintentar" color="#4f545c" onPress={retry} />}
        </>
      ) : (
        <Button
          label={connecting ? VOICE_TEXTS.connecting : 'Unirse'}
          color={connecting ? '#2d7d46' : '#3ba55d'}
          busy={connecting}
          onPress={() => join(channel)}
        />
      )}
    </View>
  );
};
