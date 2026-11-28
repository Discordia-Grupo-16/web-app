import { render } from '@testing-library/react-native';
import type { CameraTrackRef } from './livekitAdapter';
import { CameraVideo } from './CameraVideo';

const mockVideoTrack = jest.fn<null, [Record<string, unknown>]>(() => null);
jest.mock('@livekit/react-native', () => ({ VideoTrack: (props: Record<string, unknown>) => mockVideoTrack(props) }));

const ref = { participant: {}, publication: {}, source: 'camera' } as unknown as CameraTrackRef;

describe('CameraVideo', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([true, false])('draws the track covering the tile, with mirror %s', async (mirror) => {
    await render(<CameraVideo trackRef={ref} mirror={mirror} />);

    expect(mockVideoTrack).toHaveBeenCalledWith({
      trackRef: ref,
      objectFit: 'cover',
      mirror,
      style: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
    });
  });
});
