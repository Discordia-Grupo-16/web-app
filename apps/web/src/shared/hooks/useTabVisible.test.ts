import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTabVisible } from './useTabVisible';

const setVisibility = (state: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
};

describe('useTabVisible', () => {
    afterEach(() => setVisibility('visible'));

    it('starts with what the document says', () => {
        setVisibility('hidden');

        const { result } = renderHook(() => useTabVisible());

        expect(result.current).toBe(false);
    });

    it('follows the tab going to the background and coming back', () => {
        const { result } = renderHook(() => useTabVisible());
        expect(result.current).toBe(true);

        act(() => setVisibility('hidden'));
        expect(result.current).toBe(false);

        act(() => setVisibility('visible'));
        expect(result.current).toBe(true);
    });

    it('stops listening on unmount', () => {
        const { result, unmount } = renderHook(() => useTabVisible());

        unmount();
        act(() => setVisibility('hidden'));

        expect(result.current).toBe(true);
    });
});
