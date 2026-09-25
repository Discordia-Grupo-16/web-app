import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { getServer } from '@/services/serversService';
import { ChatScreen } from '@/realtime/components/ChatScreen';
import { isGoneError, useFocusedPolling } from '@/hooks/useFocusedPolling';

export default function ChannelScreen() {
  const { serverId, channelId, name } = useLocalSearchParams<{ serverId: string; channelId: string; name?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const [channelName, setChannelName] = useState<string | null>(name ?? null);

  useEffect(() => {
    if (channelName !== null) {
      navigation.setOptions({ title: `#${channelName}` });
      return;
    }
    // No name in the params (e.g. opened from a deep link): look it up like ServerScreen does.
    let cancelled = false;
    getServer(serverId)
      .then((server) => {
        if (cancelled) return;
        const channel = server.channels.find((ch) => ch.id === channelId);
        if (!channel) throw new Error('channel not found');
        setChannelName(channel.name);
      })
      .catch(() => {
        if (cancelled) return;
        Alert.alert('Error', 'No se pudo cargar el canal.');
        router.back();
      });
    return () => {
      cancelled = true;
    };
  }, [channelName, serverId, channelId, navigation, router]);

  // The channel (or its whole server) was deleted from another client: leave the chat.
  const goneRef = useRef(false);
  useFocusedPolling(() => {
    if (goneRef.current) return;
    const leave = (message: string, toServerList: boolean) => {
      if (goneRef.current) return;
      goneRef.current = true;
      Alert.alert('Canal no disponible', message);
      if (toServerList && router.canDismiss()) router.dismissAll();
      else router.back();
    };
    getServer(serverId)
      .then((server) => {
        if (!server.channels.some((ch) => ch.id === channelId)) leave('Este canal fue eliminado.', false);
      })
      .catch((err) => {
        if (isGoneError(err)) leave('Este servidor fue eliminado o ya no sos miembro.', true);
      });
  });

  if (channelName === null) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator size="large" color="#7289da" />
      </View>
    );
  }

  return <ChatScreen channelId={channelId} channelName={channelName} />;
}
