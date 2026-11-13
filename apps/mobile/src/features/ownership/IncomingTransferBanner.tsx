import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BACKUP_POLL_INTERVAL_MS,
  OWNERSHIP_TEXTS,
  ownershipErrorText,
  useIncomingOwnershipTransfers,
  useIncomingTransferWatch,
  useServerEvents,
  type IncomingTransferView,
} from '@discordia/core';
import { ownershipSource } from '@/shared/api';
import { useAppActiveRefresh } from '@/shared/hooks/useAppActiveRefresh';

interface StripeProps {
  transfer: IncomingTransferView;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onChange: () => void;
}

// One stripe per pending transfer. It watches its own server, so accepting in another session of
// the recipient takes it away without reloading.
function TransferStripe({ transfer, onAccept, onReject, onRetry, onDismiss, onChange }: StripeProps) {
  useIncomingTransferWatch({ serverId: transfer.serverId, onChange });

  const busy = transfer.busy !== null;
  const retryable = transfer.error?.kind === 'network' || transfer.error?.kind === 'service';
  const confirmAccept = () =>
    Alert.alert(OWNERSHIP_TEXTS.transfer, OWNERSHIP_TEXTS.acceptConfirm(transfer.serverName), [
      { text: OWNERSHIP_TEXTS.cancel, style: 'cancel' },
      { text: OWNERSHIP_TEXTS.accept, onPress: onAccept },
    ]);

  if (transfer.stale) {
    return (
      <View className="flex-row items-center gap-3 px-4 py-2">
        <Text accessibilityRole="alert" className="flex-1 text-white text-sm">
          {transfer.error ? ownershipErrorText(transfer.error) : ''}
        </Text>
        <TouchableOpacity onPress={onDismiss} className="px-3 py-1 rounded bg-white/20">
          <Text className="text-white font-semibold text-sm">{OWNERSHIP_TEXTS.close}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="px-4 py-2 gap-2">
      <Text className="text-white text-sm">{OWNERSHIP_TEXTS.incoming(transfer.fromName, transfer.serverName)}</Text>
      {transfer.error ? (
        <Text accessibilityRole="alert" className="text-white font-semibold text-sm">
          {ownershipErrorText(transfer.error)}
        </Text>
      ) : null}
      <View className="flex-row justify-end gap-3">
        {retryable ? (
          <TouchableOpacity onPress={onRetry} disabled={busy} className="px-3 py-1 rounded bg-white/20">
            <Text className="text-white font-semibold text-sm">{OWNERSHIP_TEXTS.retry}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={confirmAccept}
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          className="px-3 py-1 rounded bg-white/20"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Text className="text-white font-semibold text-sm">
            {transfer.busy === 'accepting' ? 'Aceptando…' : OWNERSHIP_TEXTS.accept}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onReject}
          disabled={busy}
          accessibilityState={{ disabled: busy }}
          className="px-3 py-1 rounded bg-white/20"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Text className="text-white font-semibold text-sm">
            {transfer.busy === 'rejecting' ? 'Rechazando…' : OWNERSHIP_TEXTS.reject}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * The transfers of ownership waiting for the user's answer, fixed on top of every screen with a
 * session (SCRUM-35, Transferir propiedad del servidor). The layout is not a screen, so it does not
 * use the focus-based refresh: it refreshes on notices and when the app comes back to the foreground.
 * It never asks for a system permission nor sends a notification.
 */
export function IncomingTransferBanner() {
  const { top } = useSafeAreaInsets();
  const { transfers, reload, accept, reject, retry, dismiss } = useIncomingOwnershipTransfers({
    source: ownershipSource,
  });
  useServerEvents({ resources: ['ownershipTransfers', 'servers'], onInvalidate: reload });
  useAppActiveRefresh(reload, BACKUP_POLL_INTERVAL_MS);

  if (transfers.length === 0) return null;
  return (
    <View className="bg-[#7289da]" style={{ paddingTop: top }}>
      {transfers.map((transfer) => (
        <TransferStripe
          key={transfer.serverId}
          transfer={transfer}
          onAccept={() => void accept(transfer.serverId)}
          onReject={() => void reject(transfer.serverId)}
          onRetry={() => retry(transfer.serverId)}
          onDismiss={() => dismiss(transfer.serverId)}
          onChange={reload}
        />
      ))}
    </View>
  );
}
