import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { PERMISSION_COPY, editErrorText, type RealtimeStatus, type RejectedMessage } from '@discordia/core';

interface MessageComposerProps {
  channelName: string;
  status: RealtimeStatus;
  maxLength: number;
  onSend: (content: string) => void;
  rejected: RejectedMessage | null;
  onRejectedHandled: () => void;
  /** SEND_MESSAGES, resolved by `community`. The backend checks it too: this only hides it. */
  canSendMessages: boolean;
  /**
   * Edit mode (SCRUM-44): the composer holds the text of an own message and saves it instead of
   * sending. The parent keys the composer by the message, so the initial text is read only once.
   */
  editing?: {
    initialContent: string;
    /** Rejects with the HTTP error if the server refuses; the composer stays and says why. */
    onSave: (content: string) => Promise<void>;
    onCancel: () => void;
  };
}

const MAX_INPUT_HEIGHT = 120;
const COUNTER_THRESHOLD = 0.8;

export const MessageComposer = ({
  channelName,
  status,
  maxLength,
  onSend,
  rejected,
  onRejectedHandled,
  canSendMessages,
  editing,
}: MessageComposerProps) => {
  const [content, setContent] = useState(editing?.initialContent ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The server limit counts runes (code points), so [...content] instead of content.length: an emoji is 1.
  const length = [...content].length;
  const tooLong = length > maxLength;
  // Editing goes over HTTP, so it does not need the socket to be open.
  const canSend = canSendMessages && content.trim() !== '' && !tooLong && !saving && (editing ? true : status === 'open');

  // The server rejected a message the client should have blocked: show why and give the text back.
  // Done while rendering (not in an effect) so it does not cascade an extra render.
  const [handledRejection, setHandledRejection] = useState<RejectedMessage | null>(null);
  if (rejected && rejected !== handledRejection) {
    setHandledRejection(rejected);
    setError(rejected.message);
    // Keep whatever the user started typing meanwhile instead of overwriting it.
    if (rejected.code === 'MESSAGE_TOO_LONG' && content === '') setContent(rejected.content);
  }

  useEffect(() => {
    if (rejected) onRejectedHandled();
  }, [rejected, onRejectedHandled]);

  const submit = async () => {
    if (!canSend) return;
    if (editing) {
      // Nothing changed: there is nothing to tell the server, and it would not mark it as edited.
      if (content === editing.initialContent) {
        editing.onCancel();
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await editing.onSave(content);
      } catch (err) {
        setError(editErrorText(err));
        setSaving(false);
      }
      return;
    }
    // Sent as typed: trim() is only used to decide whether the button is enabled.
    onSend(content);
    // The keyboard stays open on purpose: no Keyboard.dismiss().
    setContent('');
    setError(null);
  };

  return (
    <View className="px-3 pb-3 pt-1">
      {editing && (
        <View className="flex-row items-center justify-between px-1 pb-1">
          <Text className="text-xs text-[#99aab5]">Editando mensaje</Text>
          <TouchableOpacity onPress={editing.onCancel} disabled={saving} accessibilityLabel="Cancelar edición">
            <Text className="text-xs font-semibold text-[#ed4245]">Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
      <View className="flex-row items-end rounded-lg bg-[#40444b] px-3 py-1">
        {/* Enter is a line break on touch keyboards: sending is only through the button. */}
        <TextInput
          className="flex-1 text-sm text-[#dcddde] py-2"
          style={{ maxHeight: MAX_INPUT_HEIGHT }}
          multiline
          value={content}
          onChangeText={(text) => {
            setContent(text);
            setError(null);
          }}
          editable={canSendMessages && !saving}
          placeholder={
            canSendMessages
              ? PERMISSION_COPY.sendMessage(channelName)
              : PERMISSION_COPY.cannotSendMessage(channelName)
          }
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
          onPress={() => void submit()}
          disabled={!canSend}
          accessibilityLabel={editing ? 'Guardar edición' : 'Enviar mensaje'}
        >
          <Text className="font-semibold text-[#7289da]">{editing ? 'Guardar' : 'Enviar'}</Text>
        </TouchableOpacity>
      </View>
      {error && <Text className="text-xs mt-1 text-[#ed4245]">{error}</Text>}
    </View>
  );
};
