import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { isGoneError, type Channel, type Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { useFocusedPolling } from '@/shared/hooks/useFocusedPolling';

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

  // Channels created or deleted from another client show up on focus and on the next poll.
  const goneRef = useRef(false);
  useFocusedPolling(() => {
    if (!serverId || goneRef.current) return;
    serversService.getServer(serverId)
      .then(srv => {
        setServer(prev => prev && prev.id === srv.id ? { ...prev, channels: srv.channels } : prev);
      })
      .catch(err => {
        if (!isGoneError(err) || goneRef.current) return;
        goneRef.current = true;
        Alert.alert('Servidor no disponible', 'Este servidor fue eliminado o ya no sos miembro.');
        router.back();
      });
  });

  const updateChannels = useCallback((update: (channels: Channel[]) => Channel[]) => {
    setServer(prev => prev ? { ...prev, channels: update(prev.channels) } : prev);
  }, []);

  // While we leave or delete the server ourselves, the poll must not report it as gone.
  const setLeaving = useCallback((leaving: boolean) => {
    goneRef.current = leaving;
  }, []);

  return { server, loading, updateChannels, setLeaving };
};
