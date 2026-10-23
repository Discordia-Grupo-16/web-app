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
  onKicked: (userId: string) => void;
}

/**
 * Confirms kicking a member (SCRUM-68).
 *
 * Unlike the ban dialog there is no reason field: a kick leaves no record to keep it in.
 * The warning says the half a moderator might get wrong — the member can come back with a
 * new invitation.
 */
export function KickMemberDialog({
  visible,
  serverId,
  userId,
  memberName,
  onClose,
  onKicked,
}: Props) {
  const [kicking, setKicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kick = async () => {
    setKicking(true);
    setError(null);
    try {
      await membersService.kickMember(serverId, userId);
      onKicked(userId);
      onClose();
    } catch (err) {
      // The hierarchy and the permission are the backend's: it knows the roles of both sides
      // and this screen does not. Its detail is shown as it comes, so a refusal says which
      // of the two it was.
      setError(getErrorDetail(err) || PERMISSION_COPY.kickMemberError);
      setKicking(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">
            {PERMISSION_COPY.kickMemberTitle}
          </Text>
          <Text className="text-[#99aab5] text-sm mb-4">
            {PERMISSION_COPY.kickMemberWarning(memberName)}
          </Text>

          {error ? <Text className="text-[#ed4245] text-sm mt-3">{error}</Text> : null}

          <View className="flex-row justify-end items-center gap-4 mt-6">
            <TouchableOpacity onPress={onClose} disabled={kicking} className="py-2 px-3">
              <Text className="text-[#b9bbbe] text-sm">{PERMISSION_COPY.kickCancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={kick}
              disabled={kicking}
              className="bg-[#faa61a] rounded py-2 px-4"
              style={{ opacity: kicking ? 0.6 : 1 }}
            >
              <Text className="text-white text-sm font-semibold">
                {kicking ? PERMISSION_COPY.kicking : PERMISSION_COPY.kickConfirm}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
