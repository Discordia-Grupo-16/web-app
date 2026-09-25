import { KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useAuth } from '@discordia/context';
import { useChannelMessages } from '../useChannelMessages';
import { ConnectionBanner } from './ConnectionBanner';
import { MessageComposer } from './MessageComposer';
import { MessageList } from './MessageList';

interface ChatScreenProps {
  channelId: string;
  channelName: string;
}

export const ChatScreen = ({ channelId, channelName }: ChatScreenProps) => {
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const { messages, pending, status, maxLength, send, retry, discard, rejected, clearRejected } =
    useChannelMessages(channelId);

  return (
    <SafeAreaView className="flex-1 bg-[#36393f]" edges={['bottom']}>
      <KeyboardAvoidingView className="flex-1" behavior="padding" keyboardVerticalOffset={headerHeight}>
        <ConnectionBanner status={status} />
        <MessageList
          channelName={channelName}
          messages={messages}
          pending={pending}
          currentUser={user}
          canRetry={status === 'open'}
          onRetry={retry}
          onDiscard={discard}
        />
        <MessageComposer
          channelName={channelName}
          status={status}
          maxLength={maxLength}
          onSend={send}
          rejected={rejected}
          onRejectedHandled={clearRejected}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
