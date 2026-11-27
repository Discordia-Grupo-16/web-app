import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { QUICK_REACTIONS } from '@discordia/core';

interface ReactionPickerProps {
  /** The emojis the user already reacted with: picking one of them again takes it back (CA2). */
  mine: ReadonlySet<string>;
  onPick: (emoji: string, reacted: boolean) => void;
  onClose: () => void;
}

/**
 * The quick reactions of a message (SCRUM-49), in a Modal of its own and not in the long-press
 * Alert: Android shows at most three buttons there and drops the rest without any error.
 */
export const ReactionPicker = ({ mine, onPick, onClose }: ReactionPickerProps) => (
  <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <Pressable accessibilityLabel="Cerrar" onPress={onClose} className="flex-1 justify-end bg-black/40">
      {/* A Pressable without onPress keeps a tap between the emojis from reaching the backdrop. */}
      <Pressable className="bg-[#2f3136] rounded-t-2xl px-4 pt-4 pb-8">
        <Text className="text-[#b9bbbe] text-xs font-semibold mb-3">Reaccionar</Text>
        <View accessibilityLabel="Elegir una reacción" className="flex-row flex-wrap justify-between">
          {QUICK_REACTIONS.map((emoji) => {
            const isMine = mine.has(emoji);
            return (
              <TouchableOpacity
                key={emoji}
                accessibilityRole="button"
                accessibilityLabel={`${isMine ? 'Quitar tu reacción' : 'Reaccionar con'} ${emoji}`}
                accessibilityState={{ selected: isMine }}
                onPress={() => {
                  onClose();
                  onPick(emoji, !isMine);
                }}
                className="w-10 h-10 items-center justify-center rounded-lg"
                style={isMine ? { backgroundColor: 'rgba(88, 101, 242, 0.3)' } : undefined}
              >
                <Text className="text-2xl">{emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Pressable>
  </Modal>
);
