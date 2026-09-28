import { useContext } from 'react';
import { RealtimeContext, type RealtimeContextValue } from './realtimeContext';

export const useRealtime = (): RealtimeContextValue => {
    const value = useContext(RealtimeContext);
    if (!value) throw new Error('useRealtime must be used inside <RealtimeProvider>');
    return value;
};
