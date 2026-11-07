import { Text, View } from 'react-native';

interface UnreadMarksProps {
  mentionCount: number;
  /** What the mark is about, for the screen reader: "el canal general". */
  what: string;
}

// The mark of something unread. A mention stands out from plain activity: a red pill with the count
// instead of the white dot. Mentions do not exist yet (the count is always 0), but the style is ready.
export function UnreadMarks({ mentionCount, what }: UnreadMarksProps) {
  if (mentionCount > 0) {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`${mentionCount} ${mentionCount === 1 ? 'mención sin leer' : 'menciones sin leer'} en ${what}`}
        className="ml-2 rounded-full bg-[#ed4245] px-1.5 items-center justify-center"
        style={{ minWidth: 18 }}
      >
        <Text className="text-white text-xs font-bold">{mentionCount}</Text>
      </View>
    );
  }
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Mensajes sin leer en ${what}`}
      testID="unread-dot"
      className="ml-2 rounded-full bg-white"
      style={{ width: 8, height: 8 }}
    />
  );
}
