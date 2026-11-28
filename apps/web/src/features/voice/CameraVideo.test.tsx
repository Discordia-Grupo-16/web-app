import { render } from '@testing-library/react';
import type { VideoTrack } from 'livekit-client';
import { describe, expect, it, vi } from 'vitest';
import { CameraVideo } from './CameraVideo';

// livekit-client's tracks are not needed: the component only calls attach and detach.
const fakeTrack = () => ({ attach: vi.fn(), detach: vi.fn() });
const asTrack = (track: ReturnType<typeof fakeTrack>) => track as unknown as VideoTrack;

describe('CameraVideo', () => {
    it('attaches the track to its video element on mount', () => {
        const track = fakeTrack();

        const { container } = render(<CameraVideo track={asTrack(track)} mirror={false} />);

        const video = container.querySelector('video');
        expect(video).not.toBeNull();
        expect(track.attach).toHaveBeenCalledTimes(1);
        expect(track.attach).toHaveBeenCalledWith(video);
        expect(track.detach).not.toHaveBeenCalled();
    });

    it('detaches the track from the same element on unmount', () => {
        const track = fakeTrack();
        const { container, unmount } = render(<CameraVideo track={asTrack(track)} mirror={false} />);
        const video = container.querySelector('video');

        unmount();

        expect(track.detach).toHaveBeenCalledTimes(1);
        expect(track.detach).toHaveBeenCalledWith(video);
    });

    it('detaches the old track and attaches the new one when the track changes', () => {
        const first = fakeTrack();
        const second = fakeTrack();
        const { container, rerender } = render(<CameraVideo track={asTrack(first)} mirror={false} />);
        const video = container.querySelector('video');

        rerender(<CameraVideo track={asTrack(second)} mirror={false} />);

        expect(first.detach).toHaveBeenCalledWith(video);
        expect(second.attach).toHaveBeenCalledWith(video);
    });

    it('does not attach again when it renders with the same track', () => {
        const track = fakeTrack();
        const { rerender } = render(<CameraVideo track={asTrack(track)} mirror={false} />);

        rerender(<CameraVideo track={asTrack(track)} mirror />);

        expect(track.attach).toHaveBeenCalledTimes(1);
        expect(track.detach).not.toHaveBeenCalled();
    });

    it('is muted and plays inline, so the browser lets it start by itself', () => {
        const { container } = render(<CameraVideo track={asTrack(fakeTrack())} mirror={false} />);

        const video = container.querySelector('video') as HTMLVideoElement;
        expect(video.muted).toBe(true);
        expect(video).toHaveAttribute('playsinline');
    });

    it('mirrors the picture only when asked to', () => {
        const mirrored = render(<CameraVideo track={asTrack(fakeTrack())} mirror />);
        const plain = render(<CameraVideo track={asTrack(fakeTrack())} mirror={false} />);

        expect(mirrored.container.querySelector('video')).toHaveStyle({ transform: 'scaleX(-1)' });
        expect(plain.container.querySelector('video')?.style.transform).toBe('');
    });
});
