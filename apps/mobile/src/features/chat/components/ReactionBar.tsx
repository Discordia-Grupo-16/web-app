import { Text, TouchableOpacity, View } from 'react-native';
import type { ReactionChip } from '@discordia/core';

interface ReactionBarProps {
  chips: ReactionChip[];
  /** ADD_REACTIONS. Without it the chips of others cannot be joined and there is no "＋", but the counts show. */
  canAddReactions: boolean;
  /** `reacted` is what the user asks for: true to add, false to take their reaction back. */
  onToggle: (emoji: string, reacted: boolean) => void;
  /** Opens the picker. The "＋" chip replaces a "Reaccionar" in the long-press Alert, which on Android shows at most three buttons. */
  onOpenPicker: () => void;
}

const people = (count: number): string => (count === 1 ? '1 persona' : `${count} personas`);

/** The reactions of a message (SCRUM-49): one chip per emoji with its count, the user's own highlighted. */
export const ReactionBar = ({ chips, canAddReactions, onToggle, onOpenPicker }: ReactionBarProps) => {
  if (chips.length === 0 && !canAddReactions) return null;
  return (
    <View className="flex-row flex-wrap mt-1 gap-1">
      {chips.map((chip) => {
        // Taking back one's own reaction only needs to see the channel, as on the server.
        const disabled = !chip.mine && !canAddReactions;
        return (
          <TouchableOpacity
            key={chip.emoji}
            accessibilityRole="button"
            accessibilityLabel={`${chip.mine ? 'Reaccionaste' : 'Reaccionar'} con ${chip.emoji}, ${people(chip.count)}`}
            accessibilityState={{ selected: chip.mine, disabled }}
            disabled={disabled}
            onPress={() => onToggle(chip.emoji, !chip.mine)}
            className="flex-row items-center rounded-full px-2 py-0.5 border"
            style={{
              backgroundColor: chip.mine ? 'rgba(88, 101, 242, 0.3)' : 'rgba(255, 255, 255, 0.06)',
              borderColor: chip.mine ? '#5865f2' : 'transparent',
            }}
          >
            <Text className="text-sm">{chip.emoji}</Text>
            <Text className="text-xs font-semibold text-[#dcddde] ml-1">{chip.count}</Text>
          </TouchableOpacity>
        );
      })}
      {canAddReactions && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Reaccionar"
          onPress={onOpenPicker}
          className="rounded-full px-2 py-0.5"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
        >
          <Text className="text-sm text-[#99aab5]">＋</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
