import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OWNERSHIP_TEXTS } from '@discordia/core';
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

const isOwnerConflict = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 409;

// Everyone is offered to leave. The owner cannot leave directly: confirming tells them to transfer
// the ownership or delete the server first (CA2 of "Abandonar servidor").
export function ServerActions({
  server,
  isOwner,
  onLeavingChange,
  pendingTransferTo,
  onTransferRequested,
  onDeleteRequested,
}: ServerActionsProps) {
  const router = useRouter();

  const showOwnerNotice = () => {
    const message = pendingTransferTo
      ? OWNERSHIP_TEXTS.leaveAsOwnerWithPending(pendingTransferTo)
      : OWNERSHIP_TEXTS.leaveAsOwner;
    Alert.alert('Abandonar servidor', message, [
      { text: OWNERSHIP_TEXTS.close, style: 'cancel' },
      ...(onDeleteRequested
        ? [{ text: 'Eliminar servidor', style: 'destructive' as const, onPress: onDeleteRequested }]
        : []),
      { text: OWNERSHIP_TEXTS.transfer, onPress: onTransferRequested },
    ]);
  };

  const handleLeave = () => {
    Alert.alert('Abandonar servidor', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive', onPress: async () => {
          // The backend would refuse it anyway: the owner gets the way out without the round trip.
          if (isOwner) {
            showOwnerNotice();
            return;
          }
          try {
            onLeavingChange(true);
            await serversService.leaveServer(server.id);
            router.back();
          } catch (err) {
            onLeavingChange(false);
            // Someone transferred the server to this user while the screen still showed them as a member.
            if (isOwnerConflict(err)) {
              showOwnerNotice();
              return;
            }
            Alert.alert('Error', getErrorDetail(err) || 'No se pudo abandonar el servidor.');
          }
        },
      },
    ]);
  };

  return (
    <View className="gap-3 mt-4">
      <TouchableOpacity
        onPress={handleLeave}
        className="bg-[#2c2f33] py-3 rounded-xl items-center border border-[#ed4245]"
      >
        <Text className="text-[#ed4245] font-bold">Abandonar servidor</Text>
      </TouchableOpacity>
    </View>
  );
}
