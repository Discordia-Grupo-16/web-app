import type { VoiceContextValue } from '@discordia/core';

export const voiceValue = (overrides: Partial<VoiceContextValue> = {}): VoiceContextValue => ({
  call: { status: 'idle' },
  attempt: null,
  available: true,
  audioBlocked: false,
  join: jest.fn(),
  leave: jest.fn(),
  retry: jest.fn(),
  dismiss: jest.fn(),
  startAudio: jest.fn(),
  ...overrides,
});
