import { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@discordia/core';
import { serversService } from '@/shared/api';
import type { Server } from '@discordia/api';
import { useFocusedPolling } from '@/shared/hooks/useFocusedPolling';

export function ServersScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    serversService.getServers()
      .then(setServers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Servers deleted or joined elsewhere (or left from the server screen) show up on focus and
  // on the next poll. A response from before a local change (creating a server) is dropped.
  const localChangeRef = useRef(0);
  useFocusedPolling(() => {
    const startedAt = localChangeRef.current;
    serversService.getServers()
      .then(list => { if (localChangeRef.current === startedAt) setServers(list); })
      .catch(() => { /* keep the current list; the next tick retries */ });
  });

  return (
    <SafeAreaView className="flex-1 bg-[#23272a]" edges={['bottom']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-[#2f3136] border-b border-[#202225]">
        <Text className="text-white font-black text-lg">Mis servidores</Text>
        <TouchableOpacity onPress={signOut}>
          <Text className="text-[#ed4245] text-sm font-semibold">Salir</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7289da" />
        </View>
      ) : (
        <FlatList
          data={servers}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View className="items-center mt-16">
              <Text className="text-[#99aab5] text-sm">Todavía no tenés servidores.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/server/${item.id}`)}
              className="bg-[#2c2f33] rounded-xl px-4 py-4 flex-row items-center justify-between"
            >
              <View className="flex-1 mr-3">
                <Text className="text-white font-bold text-base">{item.name}</Text>
                {item.description ? (
                  <Text className="text-[#99aab5] text-xs mt-0.5" numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <Text className="text-[#72767d] text-xs mt-1">
                  {item.channels.length} canal{item.channels.length !== 1 ? 'es' : ''}
                </Text>
              </View>
              <Text className="text-[#7289da] text-lg">›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Botones inferiores */}
      <View className="px-4 pb-4 gap-3">
        <TouchableOpacity
          onPress={() => router.push('/join')}
          className="bg-[#2c2f33] py-3 rounded-xl items-center border border-[#7289da]"
        >
          <Text className="text-[#7289da] font-bold">Unirme a un servidor</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          className="bg-[#7289da] py-3 rounded-xl items-center"
        >
          <Text className="text-white font-bold">+ Crear servidor</Text>
        </TouchableOpacity>
      </View>

      <CreateServerModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={server => { localChangeRef.current += 1; setServers(prev => [...prev, server]); setShowCreate(false); }}
      />
    </SafeAreaView>
  );
}

function CreateServerModal({
  visible, onClose, onCreated,
}: { visible: boolean; onClose: () => void; onCreated: (s: Server) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setName(''); setDescription(''); setError(null); };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const server = await serversService.createServer(name.trim(), description.trim() || undefined);
      reset();
      onCreated(server);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al crear el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">Crear servidor</Text>
          <Text className="text-[#99aab5] text-sm mb-5">Dale un nombre a tu comunidad.</Text>

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Nombre *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Mi servidor"
            placeholderTextColor="#72767d"
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-3"
          />

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Descripción (opcional)
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Sobre qué es este servidor…"
            placeholderTextColor="#72767d"
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />

          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}

          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">{loading ? 'Creando…' : 'Crear servidor'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
