// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatMutedUntil, isMutedAt, MUTE_DURATIONS, useMuteStatus } from './mute';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 27, 15, 0, 0);
const at = (ms: number) => new Date(ms).toISOString();

describe('MUTE_DURATIONS', () => {
    it('stays inside what the backend accepts, shortest first', () => {
        const seconds = MUTE_DURATIONS.map((d) => d.seconds);

        expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
        expect(Math.min(...seconds)).toBeGreaterThanOrEqual(60);
        expect(Math.max(...seconds)).toBeLessThanOrEqual(2_419_200);
    });
});

describe('isMutedAt', () => {
    it('is on before the date and off after it', () => {
        expect(isMutedAt(at(NOW + 1000), NOW)).toBe(true);
        expect(isMutedAt(at(NOW - 1000), NOW)).toBe(false);
    });

    it('is off at the exact instant, like chat', () => {
        expect(isMutedAt(at(NOW), NOW)).toBe(false);
    });

    it('is off without a date or with one that does not parse', () => {
        expect(isMutedAt(null, NOW)).toBe(false);
        expect(isMutedAt(undefined, NOW)).toBe(false);
        expect(isMutedAt('', NOW)).toBe(false);
        expect(isMutedAt('not a date', NOW)).toBe(false);
    });

    it('compares instants, not strings', () => {
        // As strings "...00.5Z" sorts before "...00Z", but it is half a second later.
        const base = '2026-11-27T15:00:00Z';
        const half = '2026-11-27T15:00:00.5Z';
        const nowMs = Date.parse(base) + 200;

        expect(half < base).toBe(true);
        expect(isMutedAt(half, nowMs)).toBe(true);
        expect(isMutedAt(base, nowMs)).toBe(false);
    });

    it('reads a date with an offset as the same instant', () => {
        expect(isMutedAt('2026-11-27T12:00:01-03:00', NOW)).toBe(true);
        expect(isMutedAt('2026-11-27T11:59:59-03:00', NOW)).toBe(false);
    });
});

describe('formatMutedUntil', () => {
    // Built from local components so the test does not depend on the time zone it runs in.
    const local = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute).getTime();

    it('shows only the hour when it ends today', () => {
        const text = formatMutedUntil(at(local(27, 18, 30)), local(27, 9, 0));

        expect(text).toMatch(/18:30/);
        expect(text).not.toMatch(/2026/);
    });

    it('shows the date and the hour when it ends another day', () => {
        const text = formatMutedUntil(at(local(30, 18, 30)), local(27, 9, 0));

        expect(text).toMatch(/30\/11\/2026/);
        expect(text).toMatch(/18:30/);
    });

    it('is empty for a date that does not parse', () => {
        expect(formatMutedUntil('not a date', NOW)).toBe('');
    });
});

describe('useMuteStatus', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('is on with the date while the mute lasts, and turns off by itself when it ends', () => {
        const until = at(NOW + 60_000);
        const { result } = renderHook(() => useMuteStatus(until));
        expect(result.current).toEqual({ muted: true, until });

        act(() => vi.advanceTimersByTime(59_999));
        expect(result.current.muted).toBe(true);

        act(() => vi.advanceTimersByTime(1));
        expect(result.current).toEqual({ muted: false, until: null });
    });

    it.each([null, undefined, at(NOW - 1000)])('is off, and arms nothing, for %s', (mutedUntil) => {
        const { result } = renderHook(() => useMuteStatus(mutedUntil));

        expect(result.current).toEqual({ muted: false, until: null });
        expect(vi.getTimerCount()).toBe(0);
    });

    it('follows a new date: muted when it arrives, free when it is lifted', () => {
        const { result, rerender } = renderHook(({ value }) => useMuteStatus(value), {
            initialProps: { value: null as string | null },
        });

        rerender({ value: at(NOW + 5000) });
        expect(result.current.muted).toBe(true);

        rerender({ value: null });
        expect(result.current.muted).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not overflow setTimeout with a 28 days mute', () => {
        const delays: number[] = [];
        const realSetTimeout = globalThis.setTimeout;
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, delay?: number) => {
            delays.push(delay ?? 0);
            return realSetTimeout(fn, delay);
        }) as typeof setTimeout);
        const until = at(NOW + 28 * DAY_MS);
        const { result } = renderHook(() => useMuteStatus(until));

        // An overflowed delay would fire at once and the hook would give the mute up on day zero.
        act(() => vi.advanceTimersByTime(1000));
        expect(result.current.muted).toBe(true);
        expect(delays.every((delay) => delay <= MAX_TIMEOUT_MS)).toBe(true);

        act(() => vi.advanceTimersByTime(27 * DAY_MS));
        expect(result.current.muted).toBe(true);

        act(() => vi.advanceTimersByTime(DAY_MS));
        expect(result.current.muted).toBe(false);
        expect(delays.length).toBeGreaterThan(1);
        expect(delays.every((delay) => delay <= MAX_TIMEOUT_MS)).toBe(true);
    });

    it('clears the timer on unmount', () => {
        const { unmount } = renderHook(() => useMuteStatus(at(NOW + 60_000)));
        expect(vi.getTimerCount()).toBe(1);

        unmount();

        expect(vi.getTimerCount()).toBe(0);
    });
});
