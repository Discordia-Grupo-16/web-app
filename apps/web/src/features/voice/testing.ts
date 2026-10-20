import { vi } from 'vitest';
import type { VoiceContextValue } from '@discordia/core';

export const voiceValue = (overrides: Partial<VoiceContextValue> = {}): VoiceContextValue => ({
    call: { status: 'idle' },
    attempt: null,
    available: true,
    audioBlocked: false,
    join: vi.fn(),
    rejoin: vi.fn(),
    leave: vi.fn(),
    toggleMute: vi.fn(),
    retry: vi.fn(),
    dismiss: vi.fn(),
    startAudio: vi.fn(),
    ...overrides,
});
