import { act, render } from '@testing-library/react-native';
import { type ReactNode } from 'react';
import type { InvalidateFrame } from '@discordia/api';
import { RealtimeContext, type RealtimeContextValue } from '@discordia/core';
import { useLiveRefresh } from './useLiveRefresh';

let mockFocused = true;
let mockPollInterval: number | undefined;
// useFocusEffect runs its callback when the screen is focused and its cleanup when it loses focus.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      useEffect(() => (mockFocused ? callback() : undefined), [callback]);
    },
  };
});
// The real poll runs on an interval; what the screen is told to poll at is what this test reads.
jest.mock('./useFocusedPolling', () => ({
  useFocusedPolling: (_tick: () => void, intervalMs: number) => {
    mockPollInterval = intervalMs;
  },
}));

const handlers = new Set<(frame: InvalidateFrame) => void>();
const realtime = {
  status: 'open',
  onInvalidate: (handler: (frame: InvalidateFrame) => void) => {
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  },
  onReconnect: () => () => undefined,
} as unknown as RealtimeContextValue;

const notice = async (frame: Omit<InvalidateFrame, 'type'>) => {
  await act(async () => {
    handlers.forEach((h) => h({ type: 'invalidate', ...frame }));
  });
};

// Past the coalescing window plus the longest random delay.
const waitForRefetch = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1400);
  });
};

const refresh = jest.fn();

function Probe() {
  useLiveRefresh({ resources: ['members'], serverId: 'srv', refresh });
  return null;
}

const renderWith = async (children: ReactNode, value: RealtimeContextValue | null = realtime) =>
  // RNTL 14: render is async.
  await render(value ? <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider> : <>{children}</>);

describe('useLiveRefresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    handlers.clear();
    mockFocused = true;
    mockPollInterval = undefined;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('refetches when a notice for its resource arrives while the screen is focused', async () => {
    await renderWith(<Probe />);

    await notice({ serverId: 'srv', resources: ['members'] });
    await waitForRefetch();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // The screens stacked underneath stay mounted: without this, one notice made every screen in the
  // stack ask for the same server.
  it('does not listen while the screen is not focused', async () => {
    mockFocused = false;
    await renderWith(<Probe />);

    await notice({ serverId: 'srv', resources: ['members'] });
    await waitForRefetch();

    expect(refresh).not.toHaveBeenCalled();
    expect(handlers.size).toBe(0);
  });

  it('keeps the poll as a slow backup while realtime is on', async () => {
    await renderWith(<Probe />);

    expect(mockPollInterval).toBe(60_000);
  });

  it('goes back to polling every 5 seconds without realtime', async () => {
    await renderWith(<Probe />, null);

    expect(mockPollInterval).toBe(5_000);
  });
});
