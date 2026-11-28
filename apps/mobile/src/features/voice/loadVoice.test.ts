const mockIsRunningInExpoGo = jest.fn();
const mockRegisterGlobals = jest.fn();
const mockCreateLivekitAdapter = jest.fn(() => ({ kind: 'adapter' }));
const mockCameraVideo = () => null;

jest.mock('expo', () => ({ isRunningInExpoGo: () => mockIsRunningInExpoGo() }));
jest.mock('@livekit/react-native', () => ({ registerGlobals: () => mockRegisterGlobals() }));
jest.mock('./livekitAdapter', () => ({ createLivekitAdapter: () => mockCreateLivekitAdapter() }));
jest.mock('./CameraVideo', () => ({ CameraVideo: mockCameraVideo }));

// Each test gets a fresh module, so the "register once" flag starts unset.
const loadFresh = (): typeof import('./loadVoice') => {
  let mod: typeof import('./loadVoice') | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual('./loadVoice');
  });
  return mod!;
};

describe('loadVoice', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null in Expo Go without touching LiveKit', () => {
    mockIsRunningInExpoGo.mockReturnValue(true);
    const { loadVoice } = loadFresh();

    expect(loadVoice()).toBeNull();
    expect(mockRegisterGlobals).not.toHaveBeenCalled();
    expect(mockCreateLivekitAdapter).not.toHaveBeenCalled();
  });

  it('returns the LiveKit adapter and the CameraVideo in a development build (C7)', () => {
    mockIsRunningInExpoGo.mockReturnValue(false);
    const { loadVoice } = loadFresh();

    expect(loadVoice()).toEqual({ adapter: { kind: 'adapter' }, CameraVideo: mockCameraVideo });
    expect(mockRegisterGlobals).toHaveBeenCalledTimes(1);
  });

  it('registers the LiveKit globals only once', () => {
    mockIsRunningInExpoGo.mockReturnValue(false);
    const { loadVoice } = loadFresh();

    loadVoice();
    loadVoice();

    expect(mockRegisterGlobals).toHaveBeenCalledTimes(1);
    expect(mockCreateLivekitAdapter).toHaveBeenCalledTimes(2);
  });
});
