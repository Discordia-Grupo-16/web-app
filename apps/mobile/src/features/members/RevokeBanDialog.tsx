import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { PERMISSION_COPY } from '@discordia/core';
import { getErrorDetail } from '@discordia/api';
import { membersService } from '@/shared/api';

interface Props {
  visible: boolean;
  serverId: string;
  userId: string;
  memberName: string;
  onClose: () => void;
  onRevoked: (userId: string) => void;
}

/**
 * Confirms revoking a ban (SCRUM-70).
 *
 * It cannot be undone from the interface either: banning again needs them to be a member,
 * so they would have to come back first. The warning says the half a moderator might get
 * wrong — revoking does not bring them back by itself, they have to accept an invitation.
 */
export function RevokeBanDialog({
  visible,
  serverId,
  userId,
  memberName,
  onClose,
  onRevoked,
}: Props) {
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const revoke = async () => {
    setRevoking(true);
    setError(null);
    try {
      await membersService.revokeBan(serverId, userId);
      onRevoked(userId);
      onClose();
    } catch (err) {
      // The permission is the backend's: its detail is shown as it comes.
      setError(getErrorDetail(err) || PERMISSION_COPY.revokeBanError);
      setRevoking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">
            {PERMISSION_COPY.revokeBanTitle}
          </Text>
          <Text className="text-[#99aab5] text-sm mb-4">
            {PERMISSION_COPY.revokeBanWarning(memberName)}
          </Text>

          {error ? (
            <Text accessibilityRole="alert" className="text-[#ed4245] text-sm mt-3">
              {error}
            </Text>
          ) : null}

          <View className="flex-row justify-end items-center gap-4 mt-6">
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onClose}
              disabled={revoking}
              className="py-2 px-3"
            >
              <Text className="text-[#b9bbbe] text-sm">{PERMISSION_COPY.revokeCancel}</Text>
            </TouchableOpacity>
            {/* El azul de la marca y no rojo: revocar devuelve el acceso, no es destructivo.
                El rol lo distingue del título, que dice lo mismo. */}
            <TouchableOpacity
              accessibilityRole="button"
              onPress={revoke}
              disabled={revoking}
              className="bg-[#7289da] rounded py-2 px-4"
              style={{ opacity: revoking ? 0.6 : 1 }}
            >
              <Text className="text-white text-sm font-semibold">
                {revoking ? PERMISSION_COPY.revoking : PERMISSION_COPY.revokeConfirm}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
