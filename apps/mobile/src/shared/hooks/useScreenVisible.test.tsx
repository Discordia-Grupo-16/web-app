import { act, render } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';
import { useScreenVisible } from './useScreenVisible';

let mockFocused = true;
// useFocusEffect runs its callback when the screen is focused and its cleanup when it loses focus.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      useEffect(() => (mockFocused ? callback() : undefined), [callback]);
    },
  };
});

let appStateHandler: ((state: string) => void) | null = null;
const remove = jest.fn();
// currentState is a plain property of AppState, not an accessor.
const setCurrentState = (state: string) => {
  (AppState as { currentState: string }).currentState = state;
};

function Probe() {
  return <Text>{useScreenVisible() ? 'visible' : 'hidden'}</Text>;
}

const changeAppState = async (state: string) => {
  await act(async () => appStateHandler?.(state));
};

describe('useScreenVisible', () => {
  beforeEach(() => {
    mockFocused = true;
    appStateHandler = null;
    remove.mockClear();
    setCurrentState('active');
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, handler: (s: string) => void) => {
      appStateHandler = handler;
      return { remove };
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setCurrentState('active');
  });

  it('is visible with the screen focused and the app in the foreground', async () => {
    const screen = await render(<Probe />);

    expect(screen.getByText('visible')).toBeTruthy();
  });

  // A phone in the pocket is not reading the channel it was left on.
  it('is hidden once the app goes to the background, and visible again when it returns', async () => {
    const screen = await render(<Probe />);

    await changeAppState('background');
    expect(screen.getByText('hidden')).toBeTruthy();

    await changeAppState('active');
    expect(screen.getByText('visible')).toBeTruthy();
  });

  it('is hidden when the screen is not focused, even with the app in the foreground', async () => {
    mockFocused = false;

    const screen = await render(<Probe />);

    expect(screen.getByText('hidden')).toBeTruthy();
  });

  it('is hidden when the app starts in the background', async () => {
    setCurrentState('background');

    const screen = await render(<Probe />);

    expect(screen.getByText('hidden')).toBeTruthy();
  });

  it('stops listening to the app state on unmount', async () => {
    const screen = await render(<Probe />);

    await screen.unmount();

    expect(remove).toHaveBeenCalled();
  });
});
