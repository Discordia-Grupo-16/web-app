import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import type { RealtimeStatus } from '../realtimeContext';

interface MessageComposerProps {
  channelName: string;
  status: RealtimeStatus;
  maxLength: number;
  onSend: (content: string) => void;
}

const MAX_INPUT_HEIGHT = 120;
const COUNTER_THRESHOLD = 0.8;

export const MessageComposer = ({ channelName, status, maxLength, onSend }: MessageComposerProps) => {
  const [content, setContent] = useState('');

  // The server limit counts runes (code points), so [...content] instead of content.length: an emoji is 1.
  const length = [...content].length;
  const tooLong = length > maxLength;
  const canSend = content.trim() !== '' && !tooLong && status === 'open';

  const submit = () => {
    if (!canSend) return;
    // Sent as typed: trim() is only used to decide whether the button is enabled.
    onSend(content);
    // The keyboard stays open on purpose: no Keyboard.dismiss().
    setContent('');
  };

  return (
    <View className="px-3 pb-3 pt-1">
      <View className="flex-row items-end rounded-lg bg-[#40444b] px-3 py-1">
        {/* Enter is a line break on touch keyboards: sending is only through the button. */}
        <TextInput
          className="flex-1 text-sm text-[#dcddde] py-2"
          style={{ maxHeight: MAX_INPUT_HEIGHT }}
          multiline
          value={content}
          onChangeText={setContent}
          placeholder={`Enviar mensaje a #${channelName}`}
          placeholderTextColor="#72767d"
        />
        {length >= maxLength * COUNTER_THRESHOLD && (
          <Text className="text-xs self-center mx-2" style={{ color: tooLong ? '#ed4245' : '#99aab5' }}>
            {length}/{maxLength}
          </Text>
        )}
        <TouchableOpacity
          className="self-center px-2 py-2"
          style={{ opacity: canSend ? 1 : 0.4 }}
          onPress={submit}
          disabled={!canSend}
          accessibilityLabel="Enviar mensaje"
        >
          <Text className="font-semibold text-[#7289da]">Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
