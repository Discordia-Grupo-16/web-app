import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { OWNERSHIP_TEXTS, ownershipErrorText, type OwnershipError } from '@discordia/core';

interface Props {
  visible: boolean;
  toName: string;
  serverName: string;
  busy: boolean;
  error: OwnershipError | null;
  onConfirm: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Confirms proposing the server to a member (SCRUM-35). The text says what the owner gives up if
 * the member accepts: nothing changes until then.
 */
export function TransferOwnershipDialog({ visible, toName, serverName, busy, error, onConfirm, onRetry, onClose }: Props) {
  const retryable = error?.kind === 'network' || error?.kind === 'service';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">{OWNERSHIP_TEXTS.transfer}</Text>
          <Text className="text-[#99aab5] text-sm mb-4">{OWNERSHIP_TEXTS.proposeConfirm(toName, serverName)}</Text>

          {error ? (
            <Text accessibilityRole="alert" className="text-[#ed4245] text-sm mt-3">
              {ownershipErrorText(error)}
            </Text>
          ) : null}

          <View className="flex-row justify-end items-center gap-4 mt-6">
            <TouchableOpacity onPress={onClose} disabled={busy} accessibilityState={{ disabled: busy }} className="py-2 px-3">
              <Text className="text-[#b9bbbe] text-sm">{OWNERSHIP_TEXTS.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={retryable ? onRetry : onConfirm}
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              className="bg-[#7289da] rounded py-2 px-4"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              <Text className="text-white text-sm font-semibold">
                {retryable ? OWNERSHIP_TEXTS.retry : OWNERSHIP_TEXTS.sendProposal}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
