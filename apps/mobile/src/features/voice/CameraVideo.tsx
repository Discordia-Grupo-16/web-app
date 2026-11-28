import { VideoTrack } from '@livekit/react-native';
import type { CameraTrackRef } from './livekitAdapter';

export interface CameraVideoProps {
  trackRef: CameraTrackRef;
  /** The own camera is shown mirrored, like a mirror; the others are not. */
  mirror: boolean;
}

// The video of one camera. It lives apart from the tile because @livekit/react-native needs the native
// modules, so loadVoice requires it only in a development build (C7).
export const CameraVideo = ({ trackRef, mirror }: CameraVideoProps) => (
  <VideoTrack
    trackRef={trackRef}
    objectFit="cover"
    mirror={mirror}
    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
  />
);
