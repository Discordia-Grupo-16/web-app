import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { NONE, SEND_MESSAGES, hasPermission } from '@discordia/core';
import { serversService } from '@/shared/api';
import { isGoneError } from '@discordia/api';
import { ChatScreen } from '../components/ChatScreen';
import { useFocusedPolling } from '@/shared/hooks/useFocusedPolling';

export function ChannelScreen() {
  const { serverId, channelId, name } = useLocalSearchParams<{ serverId: string; channelId: string; name?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const [channelName, setChannelName] = useState<string | null>(name ?? null);
  // null while unknown. The chat is not drawn until it is: a composer that appears usable and
  // then blocks itself looks broken, and the web does not do that either.
  const [permissions, setPermissions] = useState<number | null>(null);

  useEffect(() => {
    if (channelName !== null) navigation.setOptions({ title: `#${channelName}` });
  }, [channelName, navigation]);

  // The server is fetched even when the name came in the params, because `my_permissions` comes
  // with it and decides whether the composer is usable.
  useEffect(() => {
    let cancelled = false;
    serversService.getServer(serverId)
      .then((server) => {
        if (cancelled) return;
        const channel = server.channels.find((ch) => ch.id === channelId);
        if (!channel) throw new Error('channel not found');
        setChannelName(channel.name);
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
  }, [serverId, channelId, router]);

  // The channel (or its whole server) was deleted from another client: leave the chat. The poll
  // also refreshes the permissions, so losing SEND_MESSAGES blocks the composer without a reload.
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
    serversService.getServer(serverId)
      .then((server) => {
        if (!server.channels.some((ch) => ch.id === channelId)) {
          leave('Este canal fue eliminado.', false);
          return;
        }
        setPermissions(server.my_permissions ?? NONE);
      })
      .catch((err) => {
        if (isGoneError(err)) leave('Este servidor fue eliminado o ya no sos miembro.', true);
      });
  });

  if (channelName === null || permissions === null) {
    return (
      <View className="flex-1 items-center justify-center bg-[#23272a]">
        <ActivityIndicator size="large" color="#7289da" />
      </View>
    );
  }

  return (
    <ChatScreen
      channelId={channelId}
      channelName={channelName}
      canSendMessages={hasPermission(permissions, SEND_MESSAGES)}
    />
  );
}
