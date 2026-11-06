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
  /** Name of the recipient when a transfer is pending; null when there is none. */
  pendingTransferTo: string | null;
  /** Takes the owner to the members section, where the ownership is transferred. */
  onTransferRequested: () => void;
  /** Deleting the server (SCRUM-34). Without it, "Eliminar servidor" is not offered. */
  onDeleteRequested?: () => void;
}

// Members can leave the server. Deleting it is hidden until SCRUM-34.
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
    </View>
  );
}
