import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useBackgroundCut, type BackgroundCutOptions } from './useBackgroundCut';

let listeners: ((state: AppStateStatus) => void)[] = [];

const changeAppState = (state: AppStateStatus) => act(() => listeners.forEach((l) => l(state)));

const render = (options: BackgroundCutOptions) =>
  renderHook((props: BackgroundCutOptions) => useBackgroundCut(props), { initialProps: options });

describe('useBackgroundCut', () => {
  beforeEach(() => {
    listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);
      return {
        remove: () => {
          listeners = listeners.filter((l) => l !== listener);
        },
      };
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('cuts the call when the app goes to the background', async () => {
    const cut = jest.fn();
    await render({ inCall: true, cut });

    await changeAppState('background');

    expect(cut).toHaveBeenCalledTimes(1);
  });

  it('does nothing in the background without a call', async () => {
    const cut = jest.fn();
    await render({ inCall: false, cut });

    await changeAppState('background');

    expect(cut).not.toHaveBeenCalled();
  });

  it('does nothing when the app is only inactive', async () => {
    const cut = jest.fn();
    await render({ inCall: true, cut });

    await changeAppState('inactive');

    expect(cut).not.toHaveBeenCalled();
  });

  it('does not reconnect when the app comes back', async () => {
    const cut = jest.fn();
    const { rerender } = await render({ inCall: true, cut });
    await changeAppState('background');
    await rerender({ inCall: false, cut });

    await changeAppState('active');

    expect(cut).toHaveBeenCalledTimes(1);
  });

  it('does not cut while a permission prompt is open', async () => {
    const cut = jest.fn();
    const { result } = await render({ inCall: true, cut });
    let answer: (value: string) => void = () => undefined;

    const pending = result.current.runWithPermissionPrompt(
      () => new Promise<string>((resolve) => (answer = resolve)),
    );
    await changeAppState('background');
    await changeAppState('active');
    answer('granted');

    expect(cut).not.toHaveBeenCalled();
    await expect(pending).resolves.toBe('granted');
  });

  it('cuts again once the permission prompt is answered', async () => {
    const cut = jest.fn();
    const { result } = await render({ inCall: true, cut });

    await act(() => result.current.runWithPermissionPrompt(async () => 'granted'));
    await changeAppState('background');

    expect(cut).toHaveBeenCalledTimes(1);
  });

  it('cuts again once the permission prompt fails', async () => {
    const cut = jest.fn();
    const { result } = await render({ inCall: true, cut });

    await act(async () => {
      await expect(result.current.runWithPermissionPrompt(() => Promise.reject(new Error('boom')))).rejects.toThrow(
        'boom',
      );
    });
    await changeAppState('background');

    expect(cut).toHaveBeenCalledTimes(1);
  });
});
