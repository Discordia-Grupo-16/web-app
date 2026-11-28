import { memo, useContext } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { VOICE_TEXTS, type ChannelParticipantView } from '@discordia/core';
import { MicOffIcon } from './MicOffIcon';
import { participantInitial } from './participantInitial';
import { VoiceVideoContext } from './videoContext';
import { VolumeIcon } from './VolumeIcon';
import { VolumeOffIcon } from './VolumeOffIcon';

export interface VoiceTileProps {
  participant: ChannelParticipantView;
  speaking: boolean;
  locallyMuted: boolean;
  width: number;
  /** Mutes or unmutes this participant locally. The button shows only when it is given: not on the own tile. */
  onToggleLocalMute?: (userId: string) => void;
}

// One participant of the call: their video if they have a camera on, their avatar if not. Memoized like
// the rows of the list: when who is speaking changes, only the tiles whose `speaking` flipped render again.
export const VoiceTile = memo(({ participant: p, speaking, locallyMuted, width, onToggleLocalMute }: VoiceTileProps) => {
  const video = useContext(VoiceVideoContext);
  // cameraOn is "there is something to show", but the track can still be gone by the time this renders.
  const trackRef = p.cameraOn ? video?.cameraTrackRef(p.userId) : undefined;
  return (
    <View
      testID={`voice-tile-${p.userId}`}
      className="rounded-md overflow-hidden bg-[#2f3136]"
      style={{ width, aspectRatio: 3 / 4 }}
    >
      {video && trackRef ? (
        <View testID={`voice-video-${p.userId}`} className="absolute inset-0">
          <video.CameraVideo trackRef={trackRef} mirror={!!p.isSelf} />
        </View>
      ) : (
        <View className="absolute inset-0 items-center justify-center">
          <View
            className={`relative h-14 w-14 rounded-full overflow-hidden items-center justify-center ${
              p.loading ? 'bg-[#4f545c]' : p.userAvatar ? 'bg-transparent' : 'bg-[#5b6eae]'
            }`}
          >
            {!p.loading && p.userAvatar ? (
              <Image
                testID={`voice-avatar-${p.userId}`}
                source={{ uri: p.userAvatar }}
                resizeMode="cover"
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
              />
            ) : !p.loading ? (
              <Text className="text-2xl font-bold text-white">{participantInitial(p.name)}</Text>
            ) : null}
          </View>
        </View>
      )}
      {/* On top of the video. Grey when muted locally: seen speaking but silenced on this device. */}
      <View
        pointerEvents="none"
        testID={speaking ? `voice-speaking-${locallyMuted ? 'muted-' : ''}${p.userId}` : undefined}
        className={`absolute inset-0 rounded-md border-2 ${
          speaking ? (locallyMuted ? 'border-[#72767d]' : 'border-[#3ba55d]') : 'border-transparent'
        }`}
      />
      <Text
        numberOfLines={1}
        accessibilityState={{ busy: p.loading }}
        className={`absolute bottom-2 left-2 max-w-[85%] rounded bg-[#00000099] px-1.5 py-0.5 text-xs ${
          p.loading ? 'italic text-[#b9bbbe]' : 'text-[#dcddde]'
        }`}
      >
        {p.name}
      </Text>
      {(p.muted || onToggleLocalMute || locallyMuted) && (
        <View className="absolute right-2 top-2 flex-row items-center gap-1">
          {p.muted && (
            <View className="rounded-full bg-[#00000099] p-1">
              <MicOffIcon size={16} />
            </View>
          )}
          {onToggleLocalMute ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={locallyMuted ? VOICE_TEXTS.localUnmute : VOICE_TEXTS.localMute}
              accessibilityState={{ selected: locallyMuted }}
              hitSlop={8}
              testID={`voice-local-mute-${p.userId}`}
              onPress={() => onToggleLocalMute(p.userId)}
              className="rounded-full bg-[#00000099] p-1"
            >
              {locallyMuted ? <VolumeOffIcon size={16} labelled={false} /> : <VolumeIcon size={16} />}
            </Pressable>
          ) : (
            locallyMuted && (
              <View className="rounded-full bg-[#00000099] p-1">
                <VolumeOffIcon size={16} />
              </View>
            )
          )}
        </View>
      )}
    </View>
  );
});
