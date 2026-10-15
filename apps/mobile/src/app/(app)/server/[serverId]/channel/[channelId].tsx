import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { Channel } from '@discordia/api';
import { ChannelScreen } from '@/features/chat';
import { VoiceChannelScreen } from '@/features/voice';
import { serversService } from '@/shared/api';

type ChannelParams = { serverId: string; channelId: string; name?: string; type?: Channel['type'] };
type ChannelInfo = Pick<Channel, 'name' | 'type'>;

// The channel screen: the chat or the call, depending on the channel type the channel list passes.
export default function ChannelRoute() {
  const { serverId, channelId, name, type } = useLocalSearchParams<ChannelParams>();
  const navigation = useNavigation();
  const router = useRouter();
  const [channel, setChannel] = useState<ChannelInfo | null>(name && type ? { name, type } : null);

  useEffect(() => {
    if (channel !== null) return;
    // Opened without the type (e.g. from a deep link): look the channel up like ChannelScreen does.
    let cancelled = false;
    serversService.getServer(serverId)
      .then((server) => {
        if (cancelled) return;
        const found = server.channels.find((ch) => ch.id === channelId);
        if (!found) throw new Error('channel not found');
        setChannel({ name: found.name, type: found.type });
      })
      .catch(() => {
        if (cancelled) return;
        Alert.alert('Error', 'No se pudo cargar el canal.');
        router.back();
      });
    return () => {
      cancelled = true;
    };
  }, [channel, serverId, channelId, router]);

  useEffect(() => {
    if (channel?.type === 'voice') navigation.setOptions({ title: `🔊 ${channel.name}` });
  }, [channel, navigation]);

  if (channel === null) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator size="large" color="#7289da" />
      </View>
    );
  }

  if (channel.type === 'voice') {
    return <VoiceChannelScreen channel={{ id: channelId, serverId, name: channel.name }} />;
  }
  return <ChannelScreen />;
}
