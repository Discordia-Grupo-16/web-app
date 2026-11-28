import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { VOICE_TEXTS, type ChannelParticipantView } from '@discordia/core';
import type { CameraVideoProps } from './CameraVideo';
import type { CameraTrackRef } from './livekitAdapter';
import { VoiceTile } from './VoiceTile';
import { VoiceVideoContext, type VoiceVideo } from './videoContext';

const view = (extra: Partial<ChannelParticipantView> = {}): ChannelParticipantView => ({
  userId: 'u1',
  name: 'Ana',
  userAvatar: '',
  loading: false,
  muted: false,
  cameraOn: false,
  isSelf: false,
  ...extra,
});

const ref = { participant: {}, publication: {}, source: 'camera' } as unknown as CameraTrackRef;

// A context whose CameraVideo draws a marker and records the props it gets.
const fakeVideo = (found: CameraTrackRef | null = ref) => {
  const CameraVideo = jest.fn<ReactElement, [CameraVideoProps]>(() => <View testID="fake-camera-video" />);
  const cameraTrackRef = jest.fn(() => found ?? undefined);
  return { CameraVideo, cameraTrackRef, video: { CameraVideo, cameraTrackRef } satisfies VoiceVideo };
};

const renderTile = (
  p: ChannelParticipantView,
  extra: { video?: VoiceVideo | null; speaking?: boolean; locallyMuted?: boolean; onToggleLocalMute?: (id: string) => void } = {},
) =>
  render(
    <VoiceVideoContext.Provider value={extra.video ?? null}>
      <VoiceTile
        participant={p}
        speaking={extra.speaking ?? false}
        locallyMuted={extra.locallyMuted ?? false}
        width={180}
        onToggleLocalMute={extra.onToggleLocalMute}
      />
    </VoiceVideoContext.Provider>,
  );

describe('VoiceTile', () => {
  it('has the width it is given and a fixed ratio', async () => {
    await renderTile(view());

    expect(screen.getByTestId('voice-tile-u1')).toHaveStyle({ width: 180, aspectRatio: 3 / 4 });
  });

  it('shows the initial in a tile without a camera', async () => {
    await renderTile(view());

    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByTestId('voice-video-u1')).toBeNull();
  });

  it('shows the avatar picture, and nothing while loading', async () => {
    const { rerender } = await renderTile(view({ userAvatar: 'https://cdn.example.com/ana.png' }));
    expect(screen.getByTestId('voice-avatar-u1').props.source).toEqual({ uri: 'https://cdn.example.com/ana.png' });

    await rerender(
      <VoiceTile participant={view({ loading: true })} speaking={false} locallyMuted={false} width={180} />,
    );
    expect(screen.queryByTestId('voice-avatar-u1')).toBeNull();
    expect(screen.queryByText('A')).toBeNull();
  });

  it('shows the video of whoever has the camera on, instead of the avatar', async () => {
    const { video, cameraTrackRef, CameraVideo } = fakeVideo();
    await renderTile(view({ cameraOn: true }), { video });

    expect(screen.getByTestId('voice-video-u1')).toBeTruthy();
    expect(screen.getByTestId('fake-camera-video')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
    expect(cameraTrackRef).toHaveBeenCalledWith('u1');
    expect(CameraVideo.mock.calls[0][0].trackRef).toBe(ref);
  });

  it('mirrors only the own camera', async () => {
    const own = fakeVideo();
    await renderTile(view({ cameraOn: true, isSelf: true }), { video: own.video });
    expect(own.CameraVideo.mock.calls[0][0].mirror).toBe(true);

    const other = fakeVideo();
    await renderTile(view({ userId: 'u2', cameraOn: true, isSelf: false }), { video: other.video });
    expect(other.CameraVideo.mock.calls[0][0].mirror).toBe(false);
  });

  it('does not even look for the track when the camera is off', async () => {
    const { video, cameraTrackRef } = fakeVideo();
    await renderTile(view({ cameraOn: false }), { video });

    expect(cameraTrackRef).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fake-camera-video')).toBeNull();
  });

  it('falls back to the avatar when the track is gone by the time it renders', async () => {
    const { video } = fakeVideo(null);
    await renderTile(view({ cameraOn: true }), { video });

    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.queryByTestId('voice-video-u1')).toBeNull();
  });

  it('shows the avatar without a video context, as in Expo Go', async () => {
    await renderTile(view({ cameraOn: true }), { video: null });

    expect(screen.getByText('A')).toBeTruthy();
  });

  it.each([
    ['green when someone speaks', false, 'voice-speaking-u1'],
    ['grey when someone speaks and is muted for me', true, 'voice-speaking-muted-u1'],
  ] as const)('draws the ring %s, with the id of the row of the list', async (_label, locallyMuted, testID) => {
    await renderTile(view(), { speaking: true, locallyMuted });

    expect(screen.getByTestId(testID)).toBeTruthy();
  });

  it('draws no ring, and gives it no id, when nobody speaks', async () => {
    await renderTile(view(), { speaking: false });

    expect(screen.queryByTestId('voice-speaking-u1')).toBeNull();
    expect(screen.queryByTestId('voice-speaking-muted-u1')).toBeNull();
  });

  it('shows the name', async () => {
    await renderTile(view({ name: 'Beto' }));

    expect(screen.getByText('Beto')).toBeTruthy();
  });

  it('shows the muted microphone of a muted participant', async () => {
    await renderTile(view({ muted: true }));

    expect(screen.getByLabelText('Silenciado')).toBeTruthy();
  });

  it('has no microphone icon for someone who is not muted', async () => {
    await renderTile(view());

    expect(screen.queryByLabelText('Silenciado')).toBeNull();
  });

  it('has the local mute button only when it is given a handler, and it works (SCRUM-57)', async () => {
    const onToggleLocalMute = jest.fn();
    await renderTile(view(), { onToggleLocalMute });

    await userEvent.setup().press(screen.getByTestId('voice-local-mute-u1'));

    expect(onToggleLocalMute).toHaveBeenCalledWith('u1');
  });

  it('has no local mute button on the own tile', async () => {
    await renderTile(view({ isSelf: true }));

    expect(screen.queryByTestId('voice-local-mute-u1')).toBeNull();
  });

  it('labels the local mute button for what it does next', async () => {
    const { rerender } = await renderTile(view(), { onToggleLocalMute: jest.fn() });
    expect(screen.getByRole('button', { name: VOICE_TEXTS.localMute })).not.toBeSelected();

    await rerender(
      <VoiceTile participant={view()} speaking={false} locallyMuted width={180} onToggleLocalMute={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: VOICE_TEXTS.localUnmute })).toBeSelected();
  });

  it('shows that someone is muted for me even without the button', async () => {
    await renderTile(view({ isSelf: true }), { locallyMuted: true });

    expect(screen.getByLabelText(VOICE_TEXTS.locallyMuted)).toBeTruthy();
  });
});
