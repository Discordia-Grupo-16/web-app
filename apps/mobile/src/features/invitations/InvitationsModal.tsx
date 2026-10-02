import { useState } from 'react';
import {
  Alert, Keyboard, Modal, ScrollView, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { Invitation } from '@discordia/api';
import { invitationsService } from '@/shared/api';

const EXPIRY_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Sin exp.', value: undefined },
  { label: '1 h', value: 1 },
  { label: '6 h', value: 6 },
  { label: '24 h', value: 24 },
  { label: '7 d', value: 168 },
];

export function InvitationsModal({ visible, serverId, invitations, onClose, onRevoked, onCreated }: {
  visible: boolean; serverId: string; invitations: Invitation[];
  onClose: () => void; onRevoked: (code: string) => void; onCreated: (inv: Invitation) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(undefined);
  const [maxUsesInput, setMaxUsesInput] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    try {
      const maxUses = maxUsesInput ? parseInt(maxUsesInput, 10) : undefined;
      const inv = await invitationsService.createInvitation(serverId, expiresInHours, maxUses);
      onCreated(inv);
      setMaxUsesInput('');
      setExpiresInHours(undefined);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'No se pudo crear la invitación.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = (code: string) => {
    Alert.alert('Revocar invitación', `¿Revocar el código "${code}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revocar', style: 'destructive', onPress: async () => {
          try {
            await invitationsService.revokeInvitation(serverId, code);
            onRevoked(code);
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.detail || 'No se pudo revocar.');
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6" style={{ maxHeight: '80%' }}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white font-black text-xl">Invitaciones</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-[#99aab5] text-2xl leading-6">×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 300 }} className="mb-4">
            {invitations.length === 0 && (
              <Text className="text-[#99aab5] text-sm text-center py-4">
                No hay invitaciones activas.
              </Text>
            )}
            {invitations.map(inv => (
              <View key={inv.id} className="bg-[#2c2f33] rounded-lg px-4 py-3 mb-2 flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-white font-mono text-sm">{inv.code}</Text>
                  <Text className="text-[#72767d] text-xs mt-0.5">
                    Usos: {inv.uses}{inv.max_uses ? `/${inv.max_uses}` : ''}
                    {inv.expires_at ? `  ·  Expira: ${new Date(inv.expires_at).toLocaleDateString()}` : ''}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={async () => { await Clipboard.setStringAsync(inv.code); Alert.alert('Copiado', `Código ${inv.code} copiado.`); }}
                    className="bg-[#7289da] px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-white text-xs font-semibold">Copiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRevoke(inv.code)}
                    className="bg-[#ed4245]/20 px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-[#ed4245] text-xs font-semibold">Revocar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-2">
            Expiración
          </Text>
          <View className="flex-row gap-2 mb-4 flex-wrap">
            {EXPIRY_OPTIONS.map(opt => (
              <TouchableOpacity
                key={String(opt.value)}
                onPress={() => setExpiresInHours(opt.value)}
                className="px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: expiresInHours === opt.value ? '#7289da' : '#2c2f33' }}
              >
                <Text style={{ color: expiresInHours === opt.value ? '#fff' : '#99aab5', fontSize: 12 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-[#99aab5] text-xs font-semibold uppercase tracking-wider mb-2">
            Límite de usos (opcional)
          </Text>
          <TextInput
            value={maxUsesInput}
            onChangeText={v => setMaxUsesInput(v.replace(/[^0-9]/g, ''))}
            placeholder="Sin límite"
            placeholderTextColor="#72767d"
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            className="bg-[#23272a] text-white rounded-lg px-4 py-3 mb-4"
          />

          <TouchableOpacity
            onPress={handleCreate}
            disabled={creating}
            className="bg-[#7289da] py-3 rounded-xl items-center"
            style={{ opacity: creating ? 0.6 : 1 }}
          >
            <Text className="text-white font-bold">
              {creating ? 'Creando…' : '+ Nueva invitación'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
