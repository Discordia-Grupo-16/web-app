import { createContext } from 'react';
import type { CameraTrackRef } from './livekitAdapter';

// Where each tile gets the camera of its participant. Outside a VoiceProvider nobody has video.
export type CameraTrackLookup = (userId: string) => CameraTrackRef | undefined;
export const VoiceVideoContext = createContext<CameraTrackLookup>(() => undefined);
