import type { ComponentType } from 'react';
import { isRunningInExpoGo } from 'expo';
import type { CameraVideoProps } from './CameraVideo';
import type { LivekitVoiceAdapter } from './livekitAdapter';

export interface LoadedVoice {
  adapter: LivekitVoiceAdapter;
  CameraVideo: ComponentType<CameraVideoProps>;
}

let globalsRegistered = false;

// LiveKit needs native WebRTC modules that Expo Go does not ship, so the voice modules (the adapter and
// CameraVideo, which draws with them) are only required inside a development build (C7). registerGlobals
// runs once, before livekit-client is first loaded.
export const loadVoice = (): LoadedVoice | null => {
  if (isRunningInExpoGo()) return null;
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native');
  if (!globalsRegistered) {
    registerGlobals();
    globalsRegistered = true;
  }
  const { createLivekitAdapter } = require('./livekitAdapter') as typeof import('./livekitAdapter');
  const { CameraVideo } = require('./CameraVideo') as typeof import('./CameraVideo');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { adapter: createLivekitAdapter(), CameraVideo };
};
