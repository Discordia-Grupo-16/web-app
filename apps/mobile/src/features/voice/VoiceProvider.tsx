import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useVoiceController, VoiceContext, VoiceSpeakersContext, type VoiceRoomAdapter } from '@discordia/core';
import { voiceService } from '@/shared/api';
import { loadVoice, type LoadedVoice } from './loadVoice';
import { useBackgroundCut, type BackgroundCut } from './useBackgroundCut';
import { VoiceVideoContext, type VoiceVideo } from './videoContext';

type PromptRunner = BackgroundCut['runWithPermissionPrompt'];

// The microphone and camera permission dialogs may send the app to the background. The adapter is built before the
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

const withPermissionPrompt = <A extends VoiceRoomAdapter>(adapter: A, gate: ReturnType<typeof createPromptGate>): A => ({
  ...adapter,
  enableMicrophone: (...args) => gate.run(() => adapter.enableMicrophone(...args)),
  enableCamera: () => gate.run(() => adapter.enableCamera()),
});

// In Expo Go there is no adapter: the controller reports voice as unavailable.
export const VoiceProvider = ({ children }: { children: ReactNode }) => {
  const [promptGate] = useState(createPromptGate);
  const [voice] = useState<LoadedVoice | null>(() => {
    const loaded = loadVoice();
    return loaded && { ...loaded, adapter: withPermissionPrompt(loaded.adapter, promptGate) };
  });
  // Built once: a new object per render would re-render every tile that reads the video context.
  const [video] = useState<VoiceVideo | null>(() =>
    voice ? { cameraTrackRef: voice.adapter.cameraTrackRef, CameraVideo: voice.CameraVideo } : null,
  );
  const { value, speakingIds, disconnectWithReason } = useVoiceController({
    adapter: voice?.adapter ?? null,
    requestToken: voiceService.createVoiceToken,
    refreshPermissions: voiceService.refreshVoicePermissions,
  });

  const cut = useCallback(() => disconnectWithReason('app_backgrounded'), [disconnectWithReason]);
  // A join in progress also counts: otherwise it would open the room and the microphone behind the user.
  const active = value.call.status === 'connected' || value.attempt?.status === 'connecting';
  const { runWithPermissionPrompt } = useBackgroundCut({ active, cut });
  useEffect(() => {
    promptGate.set(runWithPermissionPrompt);
  }, [promptGate, runWithPermissionPrompt]);

  return (
    <VoiceContext.Provider value={value}>
      <VoiceSpeakersContext.Provider value={speakingIds}>
        <VoiceVideoContext.Provider value={video}>{children}</VoiceVideoContext.Provider>
      </VoiceSpeakersContext.Provider>
    </VoiceContext.Provider>
  );
};
