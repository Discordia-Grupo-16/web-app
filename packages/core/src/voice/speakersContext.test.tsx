// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useVoiceSpeakers, VoiceSpeakersContext } from './speakersContext';

describe('useVoiceSpeakers', () => {
    it('returns an empty set outside a provider', () => {
        const { result } = renderHook(() => useVoiceSpeakers());

        expect(result.current.size).toBe(0);
    });

    it('returns the set given by the provider', () => {
        const speakers = new Set(['ana']);
        const wrapper = ({ children }: { children: ReactNode }) => (
            <VoiceSpeakersContext.Provider value={speakers}>{children}</VoiceSpeakersContext.Provider>
        );

        const { result } = renderHook(() => useVoiceSpeakers(), { wrapper });

        expect(result.current).toBe(speakers);
    });
});
