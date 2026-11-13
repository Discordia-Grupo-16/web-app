import { Fragment, useState, type ReactNode } from 'react';
import { Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Category, Channel } from '@discordia/api';
import { getErrorDetail } from '@discordia/api';
import { categoriesService, channelsService } from '@/shared/api';
import { ChannelItem } from './ChannelItem';
import { CreateChannelModal } from './CreateChannelModal';
import { EditChannelModal } from './EditChannelModal';

interface ChannelSectionProps {
  serverId: string;
  channels: Channel[];
  categories: Category[];
  canManage: boolean;
  onChannelsChange: (update: (channels: Channel[]) => Channel[]) => void;
  onCategoriesChange: (update: (categories: Category[]) => Category[]) => void;
  renderBelowChannel?: (channel: Channel) => ReactNode;
}

function CategoryNameModal({ visible, initial, title, onClose, onSave }: {
  visible: boolean; initial: string; title: string;
  onClose: () => void; onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await onSave(name.trim());
    } catch (err) {
      setError(getErrorDetail(err) || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-5">{title}</Text>
          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">Nombre *</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="nombre-de-categoría"
            placeholderTextColor="#72767d"
            autoCapitalize="words"
            returnKeyType="done"
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />
          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">{loading ? 'Guardando…' : 'Guardar'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function ChannelSection({
  serverId, channels, categories, canManage,
  onChannelsChange, onCategoriesChange, renderBelowChannel,
}: ChannelSectionProps) {
  const router = useRouter();
  const [createChannelType, setCreateChannelType] = useState<'text' | 'voice' | null>(null);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [renamingCategory, setRenamingCategory] = useState<Category | null>(null);
  const [reordering, setReordering] = useState(false);

  const sortedCategories = [...categories].sort((a, b) => a.position - b.position);
  const uncategorized = channels.filter(c => !c.category_id);
  const textUncategorized = uncategorized.filter(c => c.type === 'text');
  const voiceUncategorized = uncategorized.filter(c => c.type === 'voice');

  const handleOpenChannel = (ch: Channel) => {
    router.push({
      pathname: '/server/[serverId]/channel/[channelId]',
      params: { serverId, channelId: ch.id, name: ch.name, type: ch.type },
    });
  };

  const handleEditChannel = (updated: Channel) => {
    onChannelsChange(prev => prev.map(c => c.id === updated.id ? updated : c));
    setEditingChannel(null);
  };

  const handleDeleteChannel = (ch: Channel) => {
    Alert.alert(
      'Eliminar canal',
      `¿Eliminar #${ch.name}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              await channelsService.deleteChannel(serverId, ch.id);
              onChannelsChange(prev => prev.filter(c => c.id !== ch.id));
            } catch (err) {
              Alert.alert('Error', getErrorDetail(err) || 'No se pudo eliminar el canal.');
            }
          },
        },
      ],
    );
  };

  const handleCreateCategory = async (name: string) => {
    const cat = await categoriesService.createCategory(serverId, name);
    onCategoriesChange(prev => [...prev, cat]);
    setShowCreateCategory(false);
  };

  const handleRenameCategory = async (name: string) => {
    if (!renamingCategory) return;
    const updated = await categoriesService.renameCategory(serverId, renamingCategory.id, name);
    onCategoriesChange(prev => prev.map(c => c.id === updated.id ? updated : c));
    setRenamingCategory(null);
  };

  const handleDeleteCategory = (cat: Category) => {
    Alert.alert(
      'Eliminar categoría',
      `¿Eliminar "${cat.name}"? Los canales pasarán a Sin categoría.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              await categoriesService.deleteCategory(serverId, cat.id);
              onCategoriesChange(prev => prev.filter(c => c.id !== cat.id));
              onChannelsChange(prev => prev.map(c =>
                c.category_id === cat.id ? { ...c, category_id: null } : c
              ));
            } catch (err) {
              Alert.alert('Error', getErrorDetail(err) || 'No se pudo eliminar la categoría.');
            }
          },
        },
      ],
    );
  };

  const moveCategoryUp = async (cat: Category) => {
    const idx = sortedCategories.findIndex(c => c.id === cat.id);
    if (idx <= 0) return;
    const newOrder = sortedCategories.map(c => c.id);
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    try {
      await categoriesService.reorderCategories(serverId, newOrder);
      onCategoriesChange(prev =>
        prev.map(c => ({ ...c, position: newOrder.indexOf(c.id) }))
      );
    } catch (err) {
      Alert.alert('Error', getErrorDetail(err) || 'No se pudo reordenar.');
    }
  };

  const moveCategoryDown = async (cat: Category) => {
    const idx = sortedCategories.findIndex(c => c.id === cat.id);
    if (idx >= sortedCategories.length - 1) return;
    const newOrder = sortedCategories.map(c => c.id);
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    try {
      await categoriesService.reorderCategories(serverId, newOrder);
      onCategoriesChange(prev =>
        prev.map(c => ({ ...c, position: newOrder.indexOf(c.id) }))
      );
    } catch (err) {
      Alert.alert('Error', getErrorDetail(err) || 'No se pudo reordenar.');
    }
  };

  const handleChannelCreated = (ch: Channel) => {
    onChannelsChange(prev => [...prev, ch]);
    setCreateChannelType(null);
  };

  const renderChannels = (chs: Channel[]) =>
    chs.map(ch => (
      <Fragment key={ch.id}>
        <ChannelItem
          channel={ch}
          canManage={canManage}
          onDelete={handleDeleteChannel}
          onEdit={setEditingChannel}
          onOpen={handleOpenChannel}
        />
        {renderBelowChannel?.(ch)}
      </Fragment>
    ));

  return (
    <>
      {canManage && (
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider">Canales</Text>
          <View className="flex-row gap-2">
            {sortedCategories.length > 1 && (
              <TouchableOpacity
                onPress={() => setReordering(r => !r)}
                className="px-2 py-1 rounded bg-[#2c2f33]"
              >
                <Text className="text-[#7289da] text-xs">{reordering ? 'Listo' : 'Reordenar'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowCreateCategory(true)}
              className="px-2 py-1 rounded bg-[#2c2f33]"
            >
              <Text className="text-[#7289da] text-xs">+ Categoría</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {sortedCategories.map((cat, idx) => {
        const catChannels = channels
          .filter(c => c.category_id === cat.id)
          .sort((a, b) => a.position - b.position);
        return (
          <View key={cat.id} className="mb-3">
            <View className="flex-row items-center py-1">
              <Text
                className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider flex-1"
                numberOfLines={1}
              >
                {cat.name}
              </Text>
              {canManage && (
                <View className="flex-row items-center gap-1">
                  {reordering && (
                    <>
                      <TouchableOpacity
                        onPress={() => moveCategoryUp(cat)}
                        disabled={idx === 0}
                        className="w-7 h-7 items-center justify-center"
                        style={{ opacity: idx === 0 ? 0.3 : 1 }}
                      >
                        <Text className="text-[#99aab5]">↑</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => moveCategoryDown(cat)}
                        disabled={idx === sortedCategories.length - 1}
                        className="w-7 h-7 items-center justify-center"
                        style={{ opacity: idx === sortedCategories.length - 1 ? 0.3 : 1 }}
                      >
                        <Text className="text-[#99aab5]">↓</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    onPress={() => setRenamingCategory(cat)}
                    className="w-7 h-7 items-center justify-center"
                  >
                    <Text className="text-[#99aab5] text-sm">✏</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(cat)}
                    className="w-7 h-7 items-center justify-center"
                  >
                    <Text className="text-[#99aab5] text-sm">🗑</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {catChannels.length === 0 && (
              <Text className="text-[#72767d] text-xs px-1">Sin canales.</Text>
            )}
            {renderChannels(catChannels)}
          </View>
        );
      })}

      <View className="flex-row items-center justify-between py-1">
        <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider">
          Canales de texto
        </Text>
        {canManage && (
          <TouchableOpacity
            onPress={() => setCreateChannelType('text')}
            className="w-7 h-7 items-center justify-center"
          >
            <Text className="text-[#7289da] text-base font-bold">+</Text>
          </TouchableOpacity>
        )}
      </View>
      {textUncategorized.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">Sin canales de texto.</Text>
      )}
      {renderChannels(textUncategorized)}

      <View className="flex-row items-center justify-between py-1 mt-2">
        <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider">
          Canales de voz
        </Text>
        {canManage && (
          <TouchableOpacity
            onPress={() => setCreateChannelType('voice')}
            className="w-7 h-7 items-center justify-center"
          >
            <Text className="text-[#7289da] text-base font-bold">+</Text>
          </TouchableOpacity>
        )}
      </View>
      {voiceUncategorized.length === 0 && (
        <Text className="text-[#72767d] text-xs px-1">Sin canales de voz.</Text>
      )}
      {renderChannels(voiceUncategorized)}

      {editingChannel && (
        <EditChannelModal
          channel={editingChannel}
          serverId={serverId}
          categories={categories}
          onClose={() => setEditingChannel(null)}
          onUpdated={handleEditChannel}
        />
      )}

      {createChannelType && (
        <CreateChannelModal
          type={createChannelType}
          serverId={serverId}
          onClose={() => setCreateChannelType(null)}
          onCreated={handleChannelCreated}
        />
      )}

      <CategoryNameModal
        visible={showCreateCategory}
        initial=""
        title="Nueva categoría"
        onClose={() => setShowCreateCategory(false)}
        onSave={handleCreateCategory}
      />
      <CategoryNameModal
        visible={!!renamingCategory}
        initial={renamingCategory?.name ?? ''}
        title="Renombrar categoría"
        onClose={() => setRenamingCategory(null)}
        onSave={handleRenameCategory}
      />
    </>
  );
}
