import { useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { CurrentServerContext } from './currentServerContext';
import { useServer } from './useServer';

// The server in the URL, loaded once for everything under the layout. The side panel and the channel
// screen both need it, and each asking for it separately meant two requests for every change.
export const CurrentServerProvider = ({ children }: { children: ReactNode }) => {
    const { serverId, channelId } = useParams();
    const { server, loading, updateChannels, updateCategories, updateServer } = useServer(serverId, channelId);
    const value = useMemo(() => ({ server, loading, updateChannels, updateCategories, updateServer }), [server, loading, updateChannels, updateCategories, updateServer]);
    return <CurrentServerContext.Provider value={value}>{children}</CurrentServerContext.Provider>;
};
