import { useContext } from 'react';
import { VoiceContext } from './voiceContext';
import type { VoiceContextValue } from './types';

export const useVoice = (): VoiceContextValue => {
    const value = useContext(VoiceContext);
    if (!value) throw new Error('useVoice must be used inside <VoiceProvider>');
    return value;
};
