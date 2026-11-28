import { useEffect, useRef } from 'react';
import type { VideoTrack } from 'livekit-client';

// Draws a camera track filling its tile. The mirror is only for whoever looks at their own camera:
// the others see it the right way round.
export const CameraVideo = ({ track, mirror }: { track: VideoTrack; mirror: boolean }) => {
    const ref = useRef<HTMLVideoElement>(null);

    // attach is also what tells adaptiveStream how big the element is and whether it is shown.
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        track.attach(element);
        return () => {
            track.detach(element);
        };
    }, [track]);

    return (
        <video
            ref={ref}
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            style={mirror ? { transform: 'scaleX(-1)' } : undefined}
        />
    );
};
