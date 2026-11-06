import { useServerEvents } from '../chat/useServerEvents';

// The notices that can take a recipient's banner away: `server` when the server changes owner, and
// `permissions`, which reaches every session of the new owner even without VIEW_CHANNEL.
const WATCHED = ['server', 'permissions'];

/**
 * Called by each banner with its server, so the banner goes away when the transfer is accepted in
 * another session of the recipient (SCRUM-35, Transferir propiedad del servidor).
 */
export const useIncomingTransferWatch = ({ serverId, onChange }: { serverId: string; onChange: () => void }): void => {
    useServerEvents({ resources: WATCHED, serverId, onInvalidate: onChange });
};
