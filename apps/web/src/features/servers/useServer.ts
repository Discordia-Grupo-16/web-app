import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isGoneError, type Category, type Channel, type Server } from '@discordia/api';
import { serversService } from '@/shared/api';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

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

    // Channels created or deleted from another client, and permissions changed by someone else,
    // arrive as a notice.
    const currentServerIdRef = useRef(serverId);
    useEffect(() => {
        currentServerIdRef.current = serverId;
    }, [serverId]);

    const refreshServer = useCallback(() => {
        if (!serverId) return;
        serversService.getServer(serverId)
            .then(srv => {
                // Only the fields that change behind our back: replacing the whole server would
                // throw away a channel the user just created but this answer has not seen yet.
                setServer(prev => prev && prev.id === srv.id ? {
                    ...prev,
                    channels: srv.channels,
                    categories: srv.categories,
                    my_permissions: srv.my_permissions,
                    my_permission_names: srv.my_permission_names,
                } : prev);
            })
            .catch(err => {
                if (isGoneError(err) && currentServerIdRef.current === serverId) navigate('/');
            });
    }, [serverId, navigate]);

    useLiveRefresh({
        resources: ['server', 'channels', 'permissions'],
        serverId,
        refresh: refreshServer,
        enabled: !!serverId,
    });

    // The open channel was deleted from another client: fall back to the server view.
    useEffect(() => {
        if (server && channelId && server.id === serverId && !server.channels.some(c => c.id === channelId)) {
            navigate(`/servers/${serverId}`);
        }
    }, [server, serverId, channelId, navigate]);

    const updateChannels = useCallback((update: (channels: Channel[]) => Channel[]) => {
        setServer(prev => prev ? { ...prev, channels: update(prev.channels) } : prev);
    }, []);

    const updateCategories = useCallback((update: (cats: Category[]) => Category[]) => {
        setServer(prev => prev ? { ...prev, categories: update(prev.categories) } : prev);
    }, []);

    const updateServer = useCallback((updated: Server) => {
        setServer(prev => prev ? { ...prev, ...updated } : prev);
    }, []);

    return { server, loading, updateChannels, updateCategories, updateServer };
};
