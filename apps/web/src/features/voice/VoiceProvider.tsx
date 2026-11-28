import { useState, type ReactNode } from 'react';
import { useVoiceController, VoiceContext, VoiceSpeakersContext } from '@discordia/core';
import { voiceService } from '@/shared/api';
import { createLivekitAdapter } from './livekitAdapter';
import { VoiceVideoContext } from './videoContext';

// The call does not depend on the tab being visible: switching tabs or minimizing keeps it going.
export const VoiceProvider = ({ children }: { children: ReactNode }) => {
    const [adapter] = useState(createLivekitAdapter);
    const { value, speakingIds } = useVoiceController({
        adapter,
        requestToken: voiceService.createVoiceToken,
        refreshPermissions: voiceService.refreshVoicePermissions,
    });

    return (
        <VoiceContext.Provider value={value}>
            <VoiceSpeakersContext.Provider value={speakingIds}>
                {/* The adapter lives in a useState, so this value is stable. */}
                <VoiceVideoContext.Provider value={adapter.cameraTrackRef}>{children}</VoiceVideoContext.Provider>
            </VoiceSpeakersContext.Provider>
        </VoiceContext.Provider>
    );
};
