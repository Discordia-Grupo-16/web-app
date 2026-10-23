import { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PERMISSION_COPY } from '@discordia/core';
import { getErrorDetail } from '@discordia/api';
import { membersService } from '@/shared/api';

interface Props {
  visible: boolean;
  serverId: string;
  userId: string;
  memberName: string;
  onClose: () => void;
  onBanned: (userId: string) => void;
}

/**
 * Confirms banning a member (SCRUM-69).
 *
 * The confirmation is not ceremony: unlike taking a role away, this one is not
 * undone with a tap — undoing it needs the bans section, and banning again
 * requires them to be a member — so the dialog spells out that an invitation
 * will not bring them back.
 */
export function BanMemberDialog({
  visible,
  serverId,
  userId,
  memberName,
  onClose,
  onBanned,
}: Props) {
  const [reason, setReason] = useState('');
  const [banning, setBanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ban = async () => {
    setBanning(true);
    setError(null);
    try {
      await membersService.banMember(serverId, userId, reason);
      onBanned(userId);
      onClose();
    } catch (err) {
      // The hierarchy and the permission are the backend's: it knows the roles of both sides
      // and this screen does not. Its detail is shown as it comes, so a refusal says which
      // of the two it was.
      setError(getErrorDetail(err) || PERMISSION_COPY.banMemberError);
      setBanning(false);
    }
  };

  /**
   * Ignora el pedido de cierre mientras el baneo está en vuelo.
   *
   * El fondo, la X y el botón atrás de Android no miraban `banning`, así que
   * se podía cerrar el diálogo con la request empezada: si el backend la
   * rechazaba, el error no se veía nunca. Los botones de Cancelar y Banear ya
   * lo miraban; esto los iguala.
   */
  const close = () => {
    if (!banning) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">
            {PERMISSION_COPY.banMemberTitle}
          </Text>
          <Text className="text-[#99aab5] text-sm mb-4">
            {PERMISSION_COPY.banMemberWarning(memberName)}
          </Text>

          <Text className="text-[#b9bbbe] text-xs font-semibold uppercase tracking-widest mb-2">
            {PERMISSION_COPY.banReasonLabel}
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            editable={!banning}
            maxLength={500}
            placeholder={PERMISSION_COPY.banReasonPlaceholder}
            placeholderTextColor="#72767d"
            accessibilityLabel={PERMISSION_COPY.banReasonLabel}
            className="bg-[#202225] text-white text-sm rounded px-3 py-2"
          />

          {error ? <Text className="text-[#ed4245] text-sm mt-3">{error}</Text> : null}

          <View className="flex-row justify-end items-center gap-4 mt-6">
            <TouchableOpacity onPress={close} disabled={banning} className="py-2 px-3">
              <Text className="text-[#b9bbbe] text-sm">{PERMISSION_COPY.banCancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={ban}
              disabled={banning}
              className="bg-[#ed4245] rounded py-2 px-4"
              style={{ opacity: banning ? 0.6 : 1 }}
            >
              <Text className="text-white text-sm font-semibold">
                {banning ? PERMISSION_COPY.banning : PERMISSION_COPY.banConfirm}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
