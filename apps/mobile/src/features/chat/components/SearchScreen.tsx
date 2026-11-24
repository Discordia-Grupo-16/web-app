import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authorView, useAuth, usePublicProfiles, useSearchMessages } from '@discordia/core';
import { messagesService } from '@/shared/api';

interface SearchScreenProps {
  serverId: string;
  onClose: () => void;
}

const AVATAR_COLORS = ['#7289da', '#43b581', '#faa61a', '#f47fff', '#f04747', '#00b0f4', '#747f8d', '#e67e22'];

const avatarColor = (id: string): string => {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const SearchScreen = ({ serverId, onClose }: SearchScreenProps) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const { state, search, loadMore, clear } = useSearchMessages(serverId, messagesService);

  const authorIds = useMemo(
    () => [...new Set(state.results.map(r => r.authorId))].filter(id => id !== user?.id),
    [state.results, user?.id],
  );
  const profiles = usePublicProfiles(authorIds);

  const handleSearch = () => {
    if (!query.trim() && !authorFilter.trim()) return;
    search(query.trim(), authorFilter.trim());
  };

  const handleClose = () => {
    clear();
    onClose();
  };

  const hasSearched = state.activeQuery !== '' || state.activeAuthor !== '';

  return (
    <SafeAreaView className="flex-1 bg-[#36393f]" edges={['bottom']}>
      <View className="px-3 py-2" style={{ borderBottomWidth: 1, borderBottomColor: '#202225' }}>
        <View className="flex-row gap-2 items-center">
          <TextInput
            autoFocus
            className="flex-1 bg-[#40444b] text-white rounded px-3 py-2 text-sm"
            placeholder="Buscar mensajes…"
            placeholderTextColor="#72767d"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={handleSearch}
            className="px-3 py-2 rounded bg-[#5865f2] justify-center"
          >
            <Text className="text-white text-sm font-medium">Buscar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose} className="p-2" accessibilityLabel="Cerrar búsqueda">
            <Text style={{ color: '#72767d', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center gap-2 mt-2">
          <TextInput
            className="flex-1 bg-[#40444b] text-white rounded px-3 py-1.5 text-sm"
            placeholder="Filtrar por autor…"
            placeholderTextColor="#72767d"
            value={authorFilter}
            onChangeText={setAuthorFilter}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={() => setAuthorFilter(user?.name ?? '')}
            className="px-2 py-1.5 rounded"
            style={{ backgroundColor: '#2f3136' }}
          >
            <Text style={{ color: '#b9bbbe', fontSize: 12 }}>Solo mis mensajes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {state.loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7289da" />
        </View>
      ) : state.error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-sm text-center" style={{ color: '#ed4245' }}>
            Error al buscar. Intentá de nuevo.
          </Text>
        </View>
      ) : !hasSearched ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-sm text-center" style={{ color: '#72767d' }}>
            Ingresá un texto o nombre de autor y presioná Buscar.
          </Text>
        </View>
      ) : state.results.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm" style={{ color: '#72767d' }}>Sin resultados.</Text>
        </View>
      ) : (
        <FlatList
          data={state.results}
          keyExtractor={item => item.messageId}
          onEndReached={() => { if (state.hasMore && !state.loadingMore) loadMore(); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            state.loadingMore
              ? <View className="py-4"><ActivityIndicator color="#7289da" /></View>
              : state.loadMoreError
                ? (
                    <TouchableOpacity onPress={loadMore} className="items-center py-4">
                      <Text className="text-sm" style={{ color: '#ed4245' }}>
                        Error al cargar más. Reintentar
                      </Text>
                    </TouchableOpacity>
                  )
                : null
          }
          renderItem={({ item: msg }) => {
            const { name, avatarUrl } = authorView(msg.authorId, user ?? null, profiles.get(msg.authorId));
            const color = avatarColor(msg.authorId);
            const time = new Date(msg.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            return (
              <View className="flex-row px-4 py-2">
                <View
                  className="w-9 h-9 rounded-full items-center justify-center overflow-hidden mr-3 shrink-0"
                  style={{ backgroundColor: avatarUrl ? 'transparent' : color }}
                >
                  {avatarUrl
                    ? <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                    : <Text className="text-white font-bold">{(name[0] ?? '?').toUpperCase()}</Text>
                  }
                </View>
                <View className="flex-1">
                  <View className="flex-row items-baseline flex-wrap">
                    <Text className="text-white font-bold text-sm mr-2">{name}</Text>
                    <Text className="text-xs" style={{ color: '#72767d' }}>{time}</Text>
                    {msg.editedAt && (
                      <Text className="text-xs ml-1" style={{ color: '#72767d' }}> (editado)</Text>
                    )}
                  </View>
                  <Text className="text-sm text-[#dcddde]">{msg.content}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};
