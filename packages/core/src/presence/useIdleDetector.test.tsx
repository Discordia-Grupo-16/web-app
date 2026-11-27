// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeContext, type RealtimeContextValue } from '../chat/realtimeContext';
import { PRESENCE_IDLE_MINUTES, useIdleDetector } from './useIdleDetector';

const MINUTE = 60_000;

describe('useIdleDetector', () => {
    let sendActivity: ReturnType<typeof vi.fn<(idle: boolean) => void>>;

    beforeEach(() => {
        vi.useFakeTimers();
        sendActivity = vi.fn();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    const render = (idleMinutes?: number) => {
        const value = { sendActivity } as unknown as RealtimeContextValue;
        return renderHook(() => useIdleDetector(idleMinutes), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
            ),
        });
    };

    const moveMouse = () => document.dispatchEvent(new Event('mousemove'));

    it('reports idle after five minutes without interaction', () => {
        render();

        vi.advanceTimersByTime(PRESENCE_IDLE_MINUTES * MINUTE - 1);
        expect(sendActivity).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);

        expect(sendActivity).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('counts the five minutes from the last interaction', () => {
        render();

        vi.advanceTimersByTime(4 * MINUTE);
        moveMouse();
        vi.advanceTimersByTime(4 * MINUTE);
        expect(sendActivity).not.toHaveBeenCalled();
        vi.advanceTimersByTime(MINUTE);

        expect(sendActivity).toHaveBeenCalledExactlyOnceWith(true);
    });

    it.each(['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'])(
        'reports the user back on %s, and watches for idleness again',
        (type) => {
            render(1);
            vi.advanceTimersByTime(MINUTE);

            document.dispatchEvent(new Event(type));
            expect(sendActivity.mock.calls).toEqual([[true], [false]]);
            vi.advanceTimersByTime(MINUTE);

            expect(sendActivity.mock.calls).toEqual([[true], [false], [true]]);
        },
    );

    it('says nothing on interaction while the user was not idle', () => {
        render();

        moveMouse();
        moveMouse();

        expect(sendActivity).not.toHaveBeenCalled();
    });

    it('stops watching on unmount, and clears the idle mark it left', () => {
        const { unmount } = render(1);
        vi.advanceTimersByTime(MINUTE);

        unmount();
        moveMouse();
        vi.advanceTimersByTime(10 * MINUTE);

        expect(sendActivity.mock.calls).toEqual([[true], [false]]);
    });

    it('does nothing without a realtime provider', () => {
        expect(() => renderHook(() => useIdleDetector())).not.toThrow();
        expect(vi.getTimerCount()).toBe(0);
    });
});
