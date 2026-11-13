import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { NONE, SEND_MESSAGES, hasPermission, useMarkChannelRead } from '@discordia/core';
import { serversService } from '@/shared/api';
import { isGoneError } from '@discordia/api';
import { ChatScreen } from '../components/ChatScreen';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';
import { useScreenVisible } from '@/shared/hooks/useScreenVisible';

export function ChannelScreen() {
  const { serverId, channelId, name } = useLocalSearchParams<{ serverId: string; channelId: string; name?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const [channelName, setChannelName] = useState<string | null>(name ?? null);
  // null while unknown. The chat is not drawn until it is: a composer that appears usable and
  // then blocks itself looks broken, and the web does not do that either.
  const [permissions, setPermissions] = useState<number | null>(null);
  const goneRef = useRef(false);

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

  // The channel (or its whole server) was deleted from another client: leave the chat. This also
  // refreshes the permissions, so losing SEND_MESSAGES blocks the composer without a reload.
  const leave = (message: string, toServerList: boolean) => {
    if (goneRef.current) return;
    goneRef.current = true;
    Alert.alert(toServerList ? 'Servidor no disponible' : 'Canal no disponible', message);
    if (toServerList && router.canDismiss()) router.dismissAll();
    else router.back();
  };
  const refresh = () => {
    if (goneRef.current) return;
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
  };
  useLiveRefresh({ resources: ['server', 'channels', 'permissions'], serverId, refresh });
  useLiveRefresh({
    resources: ['servers'],
    serverId,
    refresh: () => {
      if (goneRef.current) return;
      serversService.getServers()
        .then(servers => {
          if (!goneRef.current && !servers.some(server => server.id === serverId)) {
            leave('Este servidor fue eliminado o suspendido.', true);
          }
        })
        .catch(console.error);
    },
  });

  // Reading is what the user does with a text channel in front of them. The mobile app only opens
  // text channels here, and a screen underneath another one, or the app in the background, does
  // not read what arrives.
  const visible = useScreenVisible();
  useMarkChannelRead(channelId, visible);

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
