import { createContext } from 'react';
import type { VoiceContextValue } from './types';

export const VoiceContext = createContext<VoiceContextValue | null>(null);
