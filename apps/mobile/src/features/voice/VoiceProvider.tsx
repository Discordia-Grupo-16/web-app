import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useVoiceController, VoiceContext, type VoiceRoomAdapter } from '@discordia/core';
import { voiceService } from '@/shared/api';
import { loadVoice } from './loadVoice';
import { useBackgroundCut, type BackgroundCut } from './useBackgroundCut';

type PromptRunner = BackgroundCut['runWithPermissionPrompt'];

// The microphone permission dialog may send the app to the background. The adapter is built before the
// hook that knows how to ignore that, so it reaches the hook's runner through this gate.
const createPromptGate = () => {
  let runner: PromptRunner = (request) => request();
  return {
    run: <T,>(request: () => Promise<T>) => runner(request),
    set: (next: PromptRunner) => {
      runner = next;
    },
  };
};

const withPermissionPrompt = (adapter: VoiceRoomAdapter, gate: ReturnType<typeof createPromptGate>): VoiceRoomAdapter => ({
  ...adapter,
  enableMicrophone: () => gate.run(() => adapter.enableMicrophone()),
});

// In Expo Go there is no adapter: the controller reports voice as unavailable.
export const VoiceProvider = ({ children }: { children: ReactNode }) => {
  const [promptGate] = useState(createPromptGate);
  const [adapter] = useState(() => {
    const loaded = loadVoice();
    return loaded && withPermissionPrompt(loaded, promptGate);
  });
  const { value, disconnectWithReason } = useVoiceController({
    adapter,
    requestToken: voiceService.createVoiceToken,
  });

  const cut = useCallback(() => disconnectWithReason('app_backgrounded'), [disconnectWithReason]);
  const { runWithPermissionPrompt } = useBackgroundCut({ active: value.call.status === 'connected', cut });
  useEffect(() => {
    promptGate.set(runWithPermissionPrompt);
  }, [promptGate, runWithPermissionPrompt]);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};
