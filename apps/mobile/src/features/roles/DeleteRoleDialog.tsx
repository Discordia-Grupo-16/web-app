import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { ROLE_DELETION_TEXTS, roleDeletionErrorText, type RoleDeletionState } from '@discordia/core';

interface DeleteRoleDialogProps {
  state: Exclude<RoleDeletionState, { stage: 'idle' }>;
  onConfirm: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Deleting a role (SCRUM-64): the blocking message, or the confirmation with its loading state,
 * error and "Reintentar". A Modal and not Alert.alert, which has neither. It only paints the state
 * of useRoleDeletion, which decides everything.
 */
export function DeleteRoleDialog({ state, onConfirm, onRetry, onClose }: DeleteRoleDialogProps) {
  const deleting = state.stage === 'confirming' && state.deleting;
  const error = state.stage === 'confirming' ? state.error : null;
  const retryable = error?.kind === 'network' || error?.kind === 'service';
  const finished = state.stage === 'blocked' || error?.kind === 'server-gone';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={deleting ? () => {} : onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-[#36393f] rounded-t-2xl p-6">
          <Text className="text-white font-black text-xl mb-1">{ROLE_DELETION_TEXTS.title}</Text>
          <Text className="text-[#99aab5] text-sm mb-4">
            {state.stage === 'blocked'
              ? state.blocker === 'default-role'
                ? ROLE_DELETION_TEXTS.defaultRole
                : ROLE_DELETION_TEXTS.soleAdmin
              : ROLE_DELETION_TEXTS.confirm(state.role.name)}
          </Text>

          {error ? (
            <Text accessibilityRole="alert" className="text-[#ed4245] text-sm mt-3">
              {roleDeletionErrorText(error)}
            </Text>
          ) : null}

          <View className="flex-row justify-end items-center gap-4 mt-6">
            {finished ? (
              <TouchableOpacity onPress={onClose} className="py-2 px-3">
                <Text className="text-[#b9bbbe] text-sm">{ROLE_DELETION_TEXTS.close}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={onClose} disabled={deleting} className="py-2 px-3">
                  <Text className="text-[#b9bbbe] text-sm">{ROLE_DELETION_TEXTS.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={retryable ? onRetry : onConfirm}
                  disabled={deleting}
                  accessibilityState={{ disabled: deleting }}
                  className="bg-[#ed4245] rounded py-2 px-4"
                  style={{ opacity: deleting ? 0.6 : 1 }}
                >
                  <Text className="text-white text-sm font-semibold">
                    {deleting
                      ? ROLE_DELETION_TEXTS.deleting
                      : retryable
                        ? ROLE_DELETION_TEXTS.retry
                        : ROLE_DELETION_TEXTS.confirmButton}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
