import type { ReactNode } from 'react';
import type { ReadStatesService } from '@discordia/api';
import { useAuth } from '../session/AuthProvider';
import type { Logger } from '../chat/useRealtimeController';
import { UnreadContext } from './unreadContext';
import { useUnreadController } from './useUnreadController';

interface UnreadProviderProps {
    service: Pick<ReadStatesService, 'getUnread' | 'markRead' | 'markAllRead'>;
    /** Error reporter. Pass `console` from the platform provider. */
    logger: Logger;
    children: ReactNode;
}

/** Goes inside the realtime provider: it listens to the messages and the reads that arrive over the socket. */
export const UnreadProvider = ({ service, logger, children }: UnreadProviderProps) => {
    const { user } = useAuth();
    const value = useUnreadController({ service, userId: user?.id ?? null, logger });
    return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
};
