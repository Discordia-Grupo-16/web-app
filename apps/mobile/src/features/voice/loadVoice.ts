import { isRunningInExpoGo } from 'expo';
import type { VoiceRoomAdapter } from '@discordia/core';

let globalsRegistered = false;

// LiveKit needs native WebRTC modules that Expo Go does not ship, so the voice modules are only required
// inside a development build. registerGlobals runs once, before livekit-client is first loaded.
export const loadVoice = (): VoiceRoomAdapter | null => {
  if (isRunningInExpoGo()) return null;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native');
  if (!globalsRegistered) {
    registerGlobals();
    globalsRegistered = true;
  }
  const { createLivekitAdapter } = require('./livekitAdapter') as typeof import('./livekitAdapter');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return createLivekitAdapter();
};
