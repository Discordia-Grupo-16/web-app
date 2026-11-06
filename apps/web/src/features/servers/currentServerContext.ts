import { createContext, useContext } from 'react';
import type { useServer } from './useServer';

export type CurrentServer = ReturnType<typeof useServer>;

export const CurrentServerContext = createContext<CurrentServer | null>(null);

export const useCurrentServer = (): CurrentServer => {
    const value = useContext(CurrentServerContext);
    if (!value) throw new Error('useCurrentServer must be used inside <CurrentServerProvider>');
    return value;
};
