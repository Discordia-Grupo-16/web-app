import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGoneError, type Channel, type Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { usePolling } from '@/shared/hooks/usePolling';

// Loads the server in the URL and keeps its channels fresh. Leaves it when it is gone (deleted, or we
// were removed), and falls back to the server view when the open channel disappears.
export const useServer = (serverId: string | undefined, channelId: string | undefined) => {
    const navigate = useNavigate();
    const [server, setServer] = useState<Server | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadServer = async () => {
            if (!serverId) {
                setServer(null);
                return;
            }

            setLoading(true);
            try {
                const srv = await serversService.getServer(serverId);
                if (isMounted) setServer(srv);
            } catch (err) {
                if (isMounted && isGoneError(err)) navigate('/');
                else console.error(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadServer();

        return () => {
            isMounted = false;
        };
    }, [serverId, navigate]);

    // Channels created or deleted from another client show up on the next poll.
    const currentServerIdRef = useRef(serverId);
    useEffect(() => {
        currentServerIdRef.current = serverId;
    }, [serverId]);

    usePolling(() => {
        if (!serverId) return;
        serversService.getServer(serverId)
            .then(srv => {
                setServer(prev => prev && prev.id === srv.id ? { ...prev, channels: srv.channels } : prev);
            })
            .catch(err => {
                if (isGoneError(err) && currentServerIdRef.current === serverId) navigate('/');
            });
    }, !!serverId);

    // The open channel was deleted from another client: fall back to the server view.
    useEffect(() => {
        if (server && channelId && server.id === serverId && !server.channels.some(c => c.id === channelId)) {
            navigate(`/servers/${serverId}`);
        }
    }, [server, serverId, channelId, navigate]);

    const updateChannels = useCallback((update: (channels: Channel[]) => Channel[]) => {
        setServer(prev => prev ? { ...prev, channels: update(prev.channels) } : prev);
    }, []);

    return { server, loading, updateChannels };
};
