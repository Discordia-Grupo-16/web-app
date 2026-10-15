import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('starts with the initial value', () => {
        const { result } = renderHook(() => useDebouncedValue('a', 300));

        expect(result.current).toBe('a');
    });

    it('only takes the last value once the delay passed without changes', () => {
        const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
            initialProps: { value: 'a' },
        });

        rerender({ value: 'an' });
        act(() => vi.advanceTimersByTime(200));
        rerender({ value: 'ana' });
        act(() => vi.advanceTimersByTime(200));
        expect(result.current).toBe('a');

        act(() => vi.advanceTimersByTime(100));
        expect(result.current).toBe('ana');
    });
});
