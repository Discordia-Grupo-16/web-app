import { createContext, useContext } from 'react';
import { NO_SPEAKERS } from './participants';

// Separate from VoiceContext: a speaker change re-renders only the components that read it.
// Outside a VoiceProvider nobody is speaking.
export const VoiceSpeakersContext = createContext<ReadonlySet<string>>(NO_SPEAKERS);

export const useVoiceSpeakers = (): ReadonlySet<string> => useContext(VoiceSpeakersContext);
