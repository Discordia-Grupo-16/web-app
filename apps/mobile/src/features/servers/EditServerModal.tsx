import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Server } from '@discordia/api';
import { getErrorDetail } from '@discordia/api';
import { serversService } from '@/shared/api';

type ImageFile = { uri: string; name: string; type: string };

interface Props {
  server: Server;
  onClose: () => void;
  onUpdated: (server: Server) => void;
}

const pickImage = async (
  aspect: [number, number],
): Promise<ImageFile | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.8,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const fileName = asset.uri.split('/').pop() ?? 'image.jpg';
  let type = asset.mimeType ?? '';
  if (!type) {
    const match = /\.(\w+)$/.exec(fileName);
    type = match ? `image/${match[1]}` : 'image/jpeg';
  }
  if (type === 'image/jpg') type = 'image/jpeg';
  return { uri: asset.uri, name: fileName, type };
};

export function EditServerModal({ server, onClose, onUpdated }: Props) {
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description ?? '');
  const [icon, setIcon] = useState<ImageFile | null>(null);
  const [banner, setBanner] = useState<ImageFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickIcon = async () => {
    setError(null);
    const file = await pickImage([1, 1]);
    if (file) setIcon(file);
  };

  const handlePickBanner = async () => {
    setError(null);
    const file = await pickImage([16, 9]);
    if (file) setBanner(file);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await serversService.updateServer(server.id, {
        name: name.trim() !== server.name ? name : undefined,
        description: description !== (server.description ?? '') ? description : undefined,
        icon: icon ? (icon as unknown as Blob) : undefined,
        banner: banner ? (banner as unknown as Blob) : undefined,
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(getErrorDetail(err) ?? 'Error al guardar los cambios');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-5">
            Configuración del servidor
          </Text>

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Nombre *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre del servidor"
            placeholderTextColor="#72767d"
            returnKeyType="done"
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Descripción
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Descripción opcional"
            placeholderTextColor="#72767d"
            returnKeyType="done"
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />

          <TouchableOpacity
            onPress={handlePickIcon}
            className="bg-[#4f545c] py-3 rounded-xl items-center mb-3"
          >
            <Text className="text-white font-semibold">
              {icon ? `Ícono: ${icon.name}` : 'Elegir ícono'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickBanner}
            className="bg-[#4f545c] py-3 rounded-xl items-center mb-4"
          >
            <Text className="text-white font-semibold">
              {banner ? `Banner: ${banner.name}` : 'Elegir banner'}
            </Text>
          </TouchableOpacity>

          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold">Guardar cambios</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setError(null); onClose(); }}
            className="py-3 items-center"
          >
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
