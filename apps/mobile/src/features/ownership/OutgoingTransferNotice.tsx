import { Text, TouchableOpacity, View } from 'react-native';
import { OWNERSHIP_TEXTS, type OutgoingTransferView } from '@discordia/core';

interface Props {
  view: OutgoingTransferView;
  busy: boolean;
  onCancel: () => void;
  onDismissRejection: () => void;
}

/** What the owner sees about the transfer of the open server: pending, rejected or nothing. */
export function OutgoingTransferNotice({ view, busy, onCancel, onDismissRejection }: Props) {
  if (view.kind === 'none') return null;
  const pending = view.kind === 'pending';

  return (
    <View className="flex-row items-center gap-2 my-2 px-3 py-2 rounded bg-[#202225]">
      <Text className="flex-1 text-[#dcddde] text-xs">
        {pending ? OWNERSHIP_TEXTS.pendingTo(view.toName) : OWNERSHIP_TEXTS.rejectedBy(view.toName)}
      </Text>
      <TouchableOpacity
        onPress={pending ? onCancel : onDismissRejection}
        disabled={busy}
        accessibilityState={{ disabled: busy }}
        className="px-2 py-1 rounded"
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        <Text className="text-[#b9bbbe] text-xs font-semibold">
          {pending ? OWNERSHIP_TEXTS.cancel : OWNERSHIP_TEXTS.close}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
