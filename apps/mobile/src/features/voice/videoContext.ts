import { createContext, type ComponentType } from 'react';
import type { CameraVideoProps } from './CameraVideo';
import type { CameraTrackRef } from './livekitAdapter';

export interface VoiceVideo {
  cameraTrackRef: (userId: string) => CameraTrackRef | undefined;
  CameraVideo: ComponentType<CameraVideoProps>;
}

// null outside a VoiceProvider or in Expo Go: there is no video to draw.
export const VoiceVideoContext = createContext<VoiceVideo | null>(null);
