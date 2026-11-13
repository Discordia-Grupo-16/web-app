// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvalidateFrame } from '@discordia/api';
import { RealtimeContext, type RealtimeContextValue } from '../chat/realtimeContext';
import { NOTICE_COALESCE_MS, NOTICE_MAX_JITTER_MS } from '../chat/useServerEvents';
import { useIncomingTransferWatch } from './useIncomingTransferWatch';

// A realtime context with only what useServerEvents reads, and a way to fire a notice.
const createFakeRealtime = () => {
    const handlers = new Set<(frame: InvalidateFrame) => void>();
    const value = {
        status: 'open',
        onInvalidate: (handler: (frame: InvalidateFrame) => void) => {
            handlers.add(handler);
            return () => {
                handlers.delete(handler);
            };
        },
        onReconnect: () => () => undefined,
    } as unknown as RealtimeContextValue;
    return {
        value,
        notice: (frame: Omit<InvalidateFrame, 'type'>) =>
            act(() => handlers.forEach((handler) => handler({ type: 'invalidate', ...frame }))),
    };
};

describe('useIncomingTransferWatch', () => {
    let realtime: ReturnType<typeof createFakeRealtime>;
    const onChange = vi.fn();

    beforeEach(() => {
        vi.useFakeTimers();
        realtime = createFakeRealtime();
        onChange.mockClear();
        renderHook(() => useIncomingTransferWatch({ serverId: 'srv', onChange }), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <RealtimeContext.Provider value={realtime.value}>{children}</RealtimeContext.Provider>
            ),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const afterTheCoalescing = () => act(() => vi.advanceTimersByTime(NOTICE_COALESCE_MS + NOTICE_MAX_JITTER_MS));

    it.each(['server', 'permissions'])('reads again on a %s notice of its server', (resource) => {
        realtime.notice({ serverId: 'srv', resources: [resource] });
        afterTheCoalescing();

        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('ignores the notices of another server', () => {
        realtime.notice({ serverId: 'other', resources: ['server'] });
        afterTheCoalescing();

        expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores the resources it does not watch', () => {
        realtime.notice({ serverId: 'srv', resources: ['channels', 'members'] });
        afterTheCoalescing();

        expect(onChange).not.toHaveBeenCalled();
    });
});
