import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { isGoneError, type Channel, type Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

// Loads the server, titles the screen with its name and keeps its channels fresh. Goes back when the
// server cannot be loaded or disappears (deleted, or we were removed).
export const useServerDetails = (serverId: string | undefined) => {
  const navigation = useNavigation();
  const router = useRouter();
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!serverId) return;
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const srv = await serversService.getServer(serverId);
        if (!isMounted) return;
        setServer(srv);
        navigation.setOptions({ title: srv.name });
      } catch {
        if (!isMounted) return;
        Alert.alert('Error', 'No se pudo cargar el servidor.');
        router.back();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [serverId, navigation, router]);

  // Channels created or deleted from another client, and permissions changed by someone else,
  // arrive as a notice, and show up on focus.
  const goneRef = useRef(false);
  const refresh = () => {
    if (!serverId || goneRef.current) return;
    serversService.getServer(serverId)
      .then(srv => {
        // Only the fields that change behind our back: replacing the whole server would throw
        // away a channel the user just created but this answer has not seen yet.
        setServer(prev => prev && prev.id === srv.id ? {
          ...prev,
          // The owner and the name change with an ownership transfer and a server edit.
          owner_id: srv.owner_id,
          name: srv.name,
          channels: srv.channels,
          my_permissions: srv.my_permissions,
          my_permission_names: srv.my_permission_names,
        } : prev);
        navigation.setOptions({ title: srv.name });
      })
      .catch(err => {
        if (!isGoneError(err) || goneRef.current) return;
        goneRef.current = true;
        Alert.alert('Servidor no disponible', 'Este servidor fue eliminado o ya no sos miembro.');
        router.back();
      });
  };
  useLiveRefresh({ resources: ['server', 'channels', 'permissions'], serverId, refresh });

  const updateChannels = useCallback((update: (channels: Channel[]) => Channel[]) => {
    setServer(prev => prev ? { ...prev, channels: update(prev.channels) } : prev);
  }, []);

  // While we leave or delete the server ourselves, the refresh must not report it as gone.
  const setLeaving = useCallback((leaving: boolean) => {
    goneRef.current = leaving;
  }, []);

  return { server, loading, updateChannels, setLeaving };
};
