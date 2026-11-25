import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { MUTE_DURATIONS, PERMISSION_COPY, formatMutedUntil, isMutedAt } from '@discordia/core';
import { getErrorDetail } from '@discordia/api';
import { membersService } from '@/shared/api';

interface Props {
  visible: boolean;
  serverId: string;
  userId: string;
  memberName: string;
  /** The member's `muted_until`: decides whether the dialog mutes or lifts the mute. */
  mutedUntil: string | null;
  onClose: () => void;
  /** After muting or lifting: the list shows the new state once it is read again. */
  onChanged: () => void;
}

/**
 * Mutes a member for a while, or lifts the mute (SCRUM-71).
 *
 * One dialog for both because the row has one button: what it does depends on whether the member
 * is muted right now. The warning says the half a moderator might get wrong: the member stays,
 * still reads and listens, and the mute ends by itself.
 */
export function MuteMemberDialog({
  visible,
  serverId,
  userId,
  memberName,
  mutedUntil,
  onClose,
  onChanged,
}: Props) {
  // Read once: the dialog keeps its mode even if the mute ends while it is open.
  const [lifting] = useState(() => isMutedAt(mutedUntil, Date.now()));
  const [seconds, setSeconds] = useState<number>(MUTE_DURATIONS[0].seconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (lifting) await membersService.unmuteMember(serverId, userId);
      else await membersService.muteMember(serverId, userId, seconds);
      onChanged();
      onClose();
    } catch (err) {
      // The hierarchy and the permission are the backend's: it knows the roles of both sides and
      // this screen does not. Its detail is shown as it comes, so a refusal says which of the two
      // it was.
      setError(getErrorDetail(err) || (lifting ? PERMISSION_COPY.unmuteMemberError : PERMISSION_COPY.muteMemberError));
      setBusy(false);
    }
  };

  // Ignores a request to close while the call is in flight, so a refusal is never lost.
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">
            {lifting ? PERMISSION_COPY.unmuteMember(memberName) : PERMISSION_COPY.muteMemberTitle}
          </Text>

          {lifting ? (
            <Text className="text-[#99aab5] text-sm mb-4">
              {PERMISSION_COPY.mutedBadge(formatMutedUntil(mutedUntil ?? ''))}
            </Text>
          ) : (
            <>
              <Text className="text-[#99aab5] text-sm mb-4">
                {PERMISSION_COPY.muteMemberWarning(memberName)}
              </Text>
              <Text className="text-[#b9bbbe] text-xs font-semibold uppercase tracking-widest mb-2">
                {PERMISSION_COPY.muteDurationLabel}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {MUTE_DURATIONS.map((duration) => {
                  const selected = duration.seconds === seconds;
                  return (
                    <TouchableOpacity
                      key={duration.seconds}
                      onPress={() => setSeconds(duration.seconds)}
                      disabled={busy}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: busy }}
                      className={`rounded py-2 px-3 ${selected ? 'bg-[#faa61a]' : 'bg-[#202225]'}`}
                    >
                      <Text className={`text-sm ${selected ? 'text-white font-semibold' : 'text-[#dcddde]'}`}>
                        {duration.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {error ? <Text accessibilityRole="alert" className="text-[#ed4245] text-sm mt-3">{error}</Text> : null}

          <View className="flex-row justify-end items-center gap-4 mt-6">
            <TouchableOpacity onPress={close} disabled={busy} className="py-2 px-3">
              <Text className="text-[#b9bbbe] text-sm">{PERMISSION_COPY.muteCancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={busy}
              className="bg-[#faa61a] rounded py-2 px-4"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              <Text className="text-white text-sm font-semibold">
                {lifting
                  ? PERMISSION_COPY.unmuteConfirm
                  : busy
                    ? PERMISSION_COPY.muting
                    : PERMISSION_COPY.muteConfirm}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
