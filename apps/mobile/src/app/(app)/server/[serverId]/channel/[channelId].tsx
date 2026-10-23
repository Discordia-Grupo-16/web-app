import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { Channel } from '@discordia/api';
import { NONE, canJoinVoice } from '@discordia/core';
import { ChannelScreen } from '@/features/chat';
import { VoiceChannelScreen } from '@/features/voice';
import { serversService } from '@/shared/api';
import { useFocusedPolling } from '@/shared/hooks/useFocusedPolling';

type ChannelParams = { serverId: string; channelId: string; name?: string; type?: Channel['type'] };
type ChannelInfo = Pick<Channel, 'name' | 'type'>;

// The channel screen: the chat or the call, depending on the channel type the channel list passes.
export default function ChannelRoute() {
  const { serverId, channelId, name, type } = useLocalSearchParams<ChannelParams>();
  const navigation = useNavigation();
  const router = useRouter();
  const [channel, setChannel] = useState<ChannelInfo | null>(name && type ? { name, type } : null);
  // The voice call needs the server permissions; null while unknown. The chat loads its own.
  const [permissions, setPermissions] = useState<number | null>(null);
  const isText = channel?.type === 'text';

  useEffect(() => {
    if (isText) return;
    // The server comes even when the type came in the params: `my_permissions` comes with it.
    let cancelled = false;
    serversService.getServer(serverId)
      .then((server) => {
        if (cancelled) return;
        const found = server.channels.find((ch) => ch.id === channelId);
        if (!found) throw new Error('channel not found');
        setChannel({ name: found.name, type: found.type });
        setPermissions(server.my_permissions ?? NONE);
      })
      .catch(() => {
        if (cancelled) return;
        Alert.alert('Error', 'No se pudo cargar el canal.');
        router.back();
      });
    return () => {
      cancelled = true;
    };
  }, [isText, serverId, channelId, router]);

  // Losing CONNECT takes "Unirse" away without a reload. A deleted channel cuts the call by itself.
  useFocusedPolling(() => {
    if (channel?.type !== 'voice') return;
    serversService.getServer(serverId)
      .then((server) => setPermissions(server.my_permissions ?? NONE))
      .catch(() => undefined);
  });

  useEffect(() => {
    if (channel?.type === 'voice') navigation.setOptions({ title: `🔊 ${channel.name}` });
  }, [channel, navigation]);

  if (channel?.type === 'text') return <ChannelScreen />;

  if (channel === null || permissions === null) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator size="large" color="#7289da" />
      </View>
    );
  }

  return (
    <VoiceChannelScreen
      channel={{ id: channelId, serverId, name: channel.name }}
      canJoin={canJoinVoice(permissions)}
    />
  );
}
