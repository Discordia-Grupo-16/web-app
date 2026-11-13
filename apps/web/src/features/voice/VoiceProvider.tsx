import { useState, type ReactNode } from 'react';
import { useVoiceController, VoiceContext, VoiceSpeakersContext } from '@discordia/core';
import { voiceService } from '@/shared/api';
import { createLivekitAdapter } from './livekitAdapter';

// The call does not depend on the tab being visible: switching tabs or minimizing keeps it going.
export const VoiceProvider = ({ children }: { children: ReactNode }) => {
    const [adapter] = useState(createLivekitAdapter);
    const { value, speakingIds } = useVoiceController({ adapter, requestToken: voiceService.createVoiceToken });

    return (
        <VoiceContext.Provider value={value}>
            <VoiceSpeakersContext.Provider value={speakingIds}>{children}</VoiceSpeakersContext.Provider>
        </VoiceContext.Provider>
    );
};
