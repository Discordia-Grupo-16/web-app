import type { VoiceController, VoiceControllerOptions } from './types';

export const useVoiceController = (options: VoiceControllerOptions): VoiceController => ({
    value: {
        call: { status: 'idle' },
        attempt: null,
        available: options.adapter !== null,
        audioBlocked: false,
        join: () => undefined,
        retry: () => undefined,
        dismiss: () => undefined,
        startAudio: () => undefined,
    },
    disconnectWithReason: () => undefined,
});
