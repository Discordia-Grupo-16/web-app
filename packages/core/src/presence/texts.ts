import type { PresenceStatus } from '@discordia/api';

/** What each status is called, the same on web and mobile. */
export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
    online: 'En línea',
    idle: 'Ausente',
    dnd: 'No molestar',
    offline: 'Desconectado',
};
