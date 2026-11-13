import { useState } from 'react';
import { Keyboard, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Category, Channel } from '@discordia/api';
import { getErrorDetail } from '@discordia/api';
import { channelsService } from '@/shared/api';

export function EditChannelModal({ channel, serverId, categories = [], onClose, onUpdated }: {
  channel: Channel; serverId: string; categories?: Category[];
  onClose: () => void; onUpdated: (ch: Channel) => void;
}) {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? '');
  const [categoryId, setCategoryId] = useState<string>(channel.category_id ?? '');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategoryName = categoryId
    ? (categories.find(c => c.id === categoryId)?.name ?? 'Sin categoría')
    : 'Sin categoría';

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await channelsService.updateChannel(
        serverId,
        channel.id,
        name.toLowerCase().replace(/\s+/g, '-'),
        channel.type === 'text' ? topic || undefined : undefined,
        categoryId || undefined,
      );
      onUpdated(updated);
    } catch (err) {
      setError(getErrorDetail(err) || 'Error al editar el canal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">Editar canal</Text>
          <Text className="text-[#99aab5] text-sm mb-5">
            Canal de {channel.type === 'text' ? 'texto' : 'voz'}
          </Text>

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Nombre *
          </Text>
          <TextInput
            value={name}
            onChangeText={v => setName(v.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="nombre-del-canal"
            placeholderTextColor="#72767d"
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />

          {channel.type === 'text' && (
            <>
              <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
                Tema (opcional)
              </Text>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="De qué se trata este canal"
                placeholderTextColor="#72767d"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
              />
            </>
          )}

          {categories.length > 0 && (
            <>
              <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
                Categoría
              </Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(v => !v)}
                className="bg-[#23272a] rounded-lg px-4 py-3 mb-1 flex-row justify-between items-center"
              >
                <Text className="text-white">{selectedCategoryName}</Text>
                <Text className="text-[#99aab5]">{showCategoryPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showCategoryPicker && (
                <ScrollView className="bg-[#23272a] rounded-lg mb-4 max-h-40" nestedScrollEnabled>
                  <TouchableOpacity
                    onPress={() => { setCategoryId(''); setShowCategoryPicker(false); }}
                    className="px-4 py-3 border-b border-[#2c2f33]"
                  >
                    <Text className={categoryId === '' ? 'text-[#7289da] font-bold' : 'text-white'}>
                      Sin categoría
                    </Text>
                  </TouchableOpacity>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => { setCategoryId(cat.id); setShowCategoryPicker(false); }}
                      className="px-4 py-3 border-b border-[#2c2f33]"
                    >
                      <Text className={categoryId === cat.id ? 'text-[#7289da] font-bold' : 'text-white'}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">{loading ? 'Guardando…' : 'Guardar cambios'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setError(null); onClose(); }} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
