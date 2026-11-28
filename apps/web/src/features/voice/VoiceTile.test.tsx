import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { VOICE_TEXTS, type ChannelParticipantView } from '@discordia/core';
import type { CameraTrackRef } from './livekitAdapter';
import { VoiceTile, type VoiceTileProps } from './VoiceTile';
import { VoiceVideoContext, type CameraTrackLookup } from './videoContext';

const ANA: ChannelParticipantView = {
    userId: 'ana',
    name: 'Ana',
    userAvatar: '',
    loading: false,
    muted: false,
    cameraOn: true,
    isSelf: false,
};

const track = () => ({ attach: vi.fn(), detach: vi.fn() });
const refWith = (videoTrack: ReturnType<typeof track> | undefined) =>
    ({ participant: {}, publication: { videoTrack } }) as unknown as CameraTrackRef;

// The lookup of the video context, handing out a fake track to everyone.
const withVideo = (lookup: CameraTrackLookup, children: ReactNode) => (
    <VoiceVideoContext.Provider value={lookup}>{children}</VoiceVideoContext.Provider>
);

const renderTile = (props: Partial<VoiceTileProps> = {}, lookup: CameraTrackLookup = () => refWith(track())) =>
    render(
        withVideo(
            lookup,
            <ul>
                <VoiceTile participant={ANA} speaking={false} locallyMuted={false} {...props} />
            </ul>,
        ),
    );

describe('VoiceTile', () => {
    describe('video or avatar', () => {
        it('draws the video of whoever has the camera on and a track to show', () => {
            const { container } = renderTile();

            expect(container.querySelector('video')).not.toBeNull();
            expect(screen.queryByText('A')).not.toBeInTheDocument();
        });

        it('draws the avatar when the camera is on but there is no track yet', () => {
            const { container } = renderTile({}, () => undefined);

            expect(container.querySelector('video')).toBeNull();
            expect(screen.getByText('A')).toBeInTheDocument();
        });

        it('draws the avatar when the publication has no video track', () => {
            const { container } = renderTile({}, () => refWith(undefined));

            expect(container.querySelector('video')).toBeNull();
            expect(screen.getByText('A')).toBeInTheDocument();
        });

        it('draws the avatar, without even asking for a track, when the camera is off', () => {
            const lookup = vi.fn(() => refWith(track()));

            const { container } = renderTile({ participant: { ...ANA, cameraOn: false } }, lookup);

            expect(container.querySelector('video')).toBeNull();
            expect(screen.getByText('A')).toBeInTheDocument();
            expect(lookup).not.toHaveBeenCalled();
        });

        it('draws the avatar without a provider: nobody has video there', () => {
            const { container } = render(
                <ul>
                    <VoiceTile participant={ANA} speaking={false} locallyMuted={false} />
                </ul>,
            );

            expect(container.querySelector('video')).toBeNull();
            expect(screen.getByText('A')).toBeInTheDocument();
        });

        it('shows the picture of the user instead of the initial when there is one', () => {
            const { container } = renderTile({ participant: { ...ANA, cameraOn: false, userAvatar: 'ana.png' } });

            expect(container.querySelector('img')).toHaveAttribute('src', 'ana.png');
            expect(screen.queryByText('A')).not.toBeInTheDocument();
        });

        it('shows neither initial nor picture while the name loads, and the name in italics', () => {
            const { container } = renderTile({
                participant: { ...ANA, cameraOn: false, name: 'Cargando…', loading: true },
            });

            expect(container.querySelector('img')).toBeNull();
            expect(screen.queryByText('C')).not.toBeInTheDocument();
            expect(screen.getByText('Cargando…')).toHaveClass('italic');
        });

        it('mirrors the video only on the own tile', () => {
            const own = renderTile({ participant: { ...ANA, isSelf: true } });
            const ownVideo = own.container.querySelector('video');
            own.unmount();
            const other = renderTile();

            expect(ownVideo).toHaveStyle({ transform: 'scaleX(-1)' });
            expect(other.container.querySelector('video')?.style.transform).toBe('');
        });

        it('shows the name over the picture', () => {
            renderTile();

            expect(screen.getByText('Ana')).toBeInTheDocument();
        });
    });

    describe('who is speaking (SCRUM-56)', () => {
        it.each([
            ['is speaking', true, false, 'true'],
            ['is speaking but muted on this device', true, true, 'muted'],
        ] as const)('marks the tile of whoever %s', (_label, speaking, locallyMuted, expected) => {
            renderTile({ speaking, locallyMuted });

            expect(screen.getByRole('listitem')).toHaveAttribute('data-speaking', expected);
        });

        it('marks nothing when nobody speaks there', () => {
            renderTile({ speaking: false, locallyMuted: true });

            expect(screen.getByRole('listitem')).not.toHaveAttribute('data-speaking');
        });

        it('puts the ring in an element over the video, hidden from assistive technology', () => {
            const { container } = renderTile({ speaking: true });

            const ring = container.querySelector('li > span[aria-hidden]:not(:has(*))') as HTMLElement | null;
            expect(ring).not.toBeNull();
            expect(ring).toHaveClass('pointer-events-none');
            expect(ring?.style.boxShadow).toContain('inset');
        });

        it('has no ring when nobody speaks', () => {
            const { container } = renderTile({ speaking: false });

            const ring = container.querySelector('li > span.pointer-events-none') as HTMLElement | null;
            expect(ring?.style.boxShadow).toBe('');
        });
    });

    describe('the icons of the corner', () => {
        it('shows the muted microphone when the participant is muted', () => {
            renderTile({ participant: { ...ANA, muted: true } });

            expect(screen.getByLabelText('Silenciado')).toBeInTheDocument();
        });

        it('shows nothing of it when the participant is not muted', () => {
            renderTile();

            expect(screen.queryByLabelText('Silenciado')).not.toBeInTheDocument();
        });

        it('has the "silence for me" button only when it is given a handler, which is not on the own tile', () => {
            const none = renderTile({ participant: { ...ANA, isSelf: true } });
            expect(none.container.querySelector('button')).toBeNull();
            none.unmount();

            renderTile({ onToggleLocalMute: vi.fn() });

            expect(screen.getByRole('button', { name: VOICE_TEXTS.localMute })).toBeInTheDocument();
        });

        it('passes the userId on click', async () => {
            const onToggleLocalMute = vi.fn();
            renderTile({ onToggleLocalMute });

            await userEvent.click(screen.getByRole('button', { name: VOICE_TEXTS.localMute }));

            expect(onToggleLocalMute).toHaveBeenCalledTimes(1);
            expect(onToggleLocalMute).toHaveBeenCalledWith('ana');
        });

        it.each([
            [false, VOICE_TEXTS.localMute, 'false'],
            [true, VOICE_TEXTS.localUnmute, 'true'],
        ] as const)('follows locallyMuted=%s in the label and aria-pressed', (locallyMuted, name, pressed) => {
            renderTile({ locallyMuted, onToggleLocalMute: vi.fn() });

            const button = screen.getByRole('button', { name });
            expect(button).toHaveAttribute('aria-pressed', pressed);
            expect(button).toHaveAttribute('title', name);
        });
    });
});
