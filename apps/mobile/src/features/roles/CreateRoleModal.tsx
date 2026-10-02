import { useState } from 'react';
import { Keyboard, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { getErrorDetail } from '@discordia/api';

export function CreateRoleModal({ visible, serverId, onClose, onCreated }: {
  visible: boolean; serverId: string;
  onClose: () => void; onCreated: (r: Role) => void;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const role = await rolesService.createRole(serverId, name.trim());
      setName('');
      onCreated(role);
    } catch (err) {
      setError(getErrorDetail(err) || 'Error al crear el rol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">Crear rol</Text>
          <Text className="text-[#99aab5] text-sm mb-5">
            Se crea con permisos por defecto al final de la jerarquía.
          </Text>
          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-1">
            Nombre *
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Moderador"
            placeholderTextColor="#72767d"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />
          {error ? <Text className="text-[#ed4245] text-sm mb-3">{error}</Text> : null}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-[#7289da] py-3 rounded-xl items-center mb-2"
            style={{ opacity: loading || !name.trim() ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">{loading ? 'Creando…' : 'Crear rol'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setName(''); setError(null); onClose(); }} className="py-3 items-center">
            <Text className="text-[#99aab5]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
