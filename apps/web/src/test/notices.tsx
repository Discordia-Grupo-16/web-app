import { act } from '@testing-library/react';
import { Fragment, type ComponentType, type ReactNode } from 'react';
import { vi } from 'vitest';
import type { InvalidateFrame } from '@discordia/api';
import { RealtimeContext, type RealtimeContextValue } from '@discordia/core';

/**
 * A realtime context that only delivers UI notices: what useServerEvents reads from it. `notice`
 * hands a frame to every listener, and `wrapper` provides the context inside `Outer`.
 */
export const withNotices = (Outer: ComponentType<{ children: ReactNode }> = Fragment) => {
    const handlers = new Set<(frame: InvalidateFrame) => void>();
    const value = {
        status: 'open',
        onInvalidate: (handler: (frame: InvalidateFrame) => void) => {
            handlers.add(handler);
            return () => {
                handlers.delete(handler);
            };
        },
        onReconnect: () => () => {},
    } as unknown as RealtimeContextValue;
    return {
        notice: (frame: Omit<InvalidateFrame, 'type'>) =>
            act(() => handlers.forEach((h) => h({ type: 'invalidate', ...frame }))),
        wrapper: ({ children }: { children: ReactNode }) => (
            <Outer>
                <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
            </Outer>
        ),
    };
};

/** Lets the notices be coalesced and delivered: the window plus the longest random delay. */
export const afterCoalescing = () => act(() => vi.advanceTimersByTimeAsync(1400));
