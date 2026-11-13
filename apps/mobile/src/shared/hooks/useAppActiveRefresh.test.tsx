import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppActiveRefresh } from './useAppActiveRefresh';

let listeners: ((state: AppStateStatus) => void)[] = [];

// React Native's test setup does not let jest replace it, so it is defined over.
const setCurrentState = (state: AppStateStatus) =>
  Object.defineProperty(AppState, 'currentState', { value: state, configurable: true, writable: true });

const changeAppState = async (state: AppStateStatus) => {
  setCurrentState(state);
  await act(() => listeners.forEach((listener) => listener(state)));
};

describe('useAppActiveRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    listeners = [];
    setCurrentState('active');
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);
      return {
        remove: () => {
          listeners = listeners.filter((l) => l !== listener);
        },
      };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('refreshes when the app comes back to the foreground', async () => {
    const tick = jest.fn();
    await renderHook(() => useAppActiveRefresh(tick, 60_000));
    await changeAppState('background');

    await changeAppState('active');

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('refreshes every interval while the app is active', async () => {
    const tick = jest.fn();
    await renderHook(() => useAppActiveRefresh(tick, 60_000));

    await act(() => jest.advanceTimersByTime(120_000));

    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('does not refresh in the background', async () => {
    const tick = jest.fn();
    await renderHook(() => useAppActiveRefresh(tick, 60_000));
    await changeAppState('background');

    await act(() => jest.advanceTimersByTime(120_000));

    expect(tick).not.toHaveBeenCalled();
  });

  it('stops when it is unmounted', async () => {
    const tick = jest.fn();
    const { unmount } = await renderHook(() => useAppActiveRefresh(tick, 60_000));
    await act(() => unmount());

    await act(() => jest.advanceTimersByTime(120_000));

    expect(tick).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(0);
  });
});
