import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { getErrorDetail } from '@discordia/api';

interface ServerActionsProps {
  server: Server;
  isOwner: boolean;
  /** Called with true before leaving or deleting, and with false if it fails. */
  onLeavingChange: (leaving: boolean) => void;
}

// Members can leave the server; the owner can delete it.
export function ServerActions({ server, isOwner, onLeavingChange }: ServerActionsProps) {
  const router = useRouter();

  const handleLeave = () => {
    Alert.alert('Abandonar servidor', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive', onPress: async () => {
          try {
            onLeavingChange(true);
            await serversService.leaveServer(server.id);
            router.back();
          } catch (err) {
            onLeavingChange(false);
            Alert.alert('Error', getErrorDetail(err) || 'No se pudo abandonar el servidor.');
          }
        },
      },
    ]);
  };

  const handleDeleteServer = () => {
    Alert.alert('Eliminar servidor', `¿Eliminar "${server.name}"? Esta acción es permanente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            onLeavingChange(true);
            await serversService.deleteServer(server.id);
            router.back();
          } catch (err) {
            onLeavingChange(false);
            Alert.alert('Error', getErrorDetail(err) || 'No se pudo eliminar el servidor.');
          }
        },
      },
    ]);
  };

  return (
    <View className="gap-3 mt-4">
      {!isOwner && (
        <TouchableOpacity
          onPress={handleLeave}
          className="bg-[#2c2f33] py-3 rounded-xl items-center border border-[#ed4245]"
        >
          <Text className="text-[#ed4245] font-bold">Abandonar servidor</Text>
        </TouchableOpacity>
      )}
      {isOwner && (
        <TouchableOpacity
          onPress={handleDeleteServer}
          className="bg-[#ed4245]/10 py-3 rounded-xl items-center border border-[#ed4245]"
        >
          <Text className="text-[#ed4245] font-bold">Eliminar servidor</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
