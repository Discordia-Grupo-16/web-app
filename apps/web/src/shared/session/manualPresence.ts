import type { ManualPresence } from '@discordia/api';

// `chat` has no endpoint to read the manual status back (SCRUM-27), so the browser remembers it.
const key = (userId: string) => `discordia.presence.${userId}`;

export const readManualPresence = (userId: string): ManualPresence => {
    const saved = localStorage.getItem(key(userId));
    return saved === 'dnd' || saved === 'invisible' ? saved : null;
};

export const saveManualPresence = (userId: string, manual: ManualPresence): void => {
    if (manual) localStorage.setItem(key(userId), manual);
    else localStorage.removeItem(key(userId));
};
