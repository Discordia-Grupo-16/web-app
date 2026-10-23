import { useState, type ReactNode } from 'react';
import { useVoiceController, VoiceContext } from '@discordia/core';
import { voiceService } from '@/shared/api';
import { createLivekitAdapter } from './livekitAdapter';

// The call does not depend on the tab being visible: switching tabs or minimizing keeps it going.
export const VoiceProvider = ({ children }: { children: ReactNode }) => {
    const [adapter] = useState(createLivekitAdapter);
    const { value } = useVoiceController({ adapter, requestToken: voiceService.createVoiceToken });

    return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};
