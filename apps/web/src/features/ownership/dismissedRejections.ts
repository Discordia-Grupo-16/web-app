import type { DismissedRejectionStore } from '@discordia/core';

// One key per server: only the last closed rejection matters, a later one has another createdAt.
const keyOf = (serverId: string) => `discordia_dismissed_rejection:${serverId}`;

// localStorage, so a closed rejection stays closed after a reload or a new tab in this browser.
export const dismissedRejections: DismissedRejectionStore = {
    async get(serverId) {
        return localStorage.getItem(keyOf(serverId));
    },
    async set(serverId, createdAt) {
        localStorage.setItem(keyOf(serverId), createdAt);
    },
};
