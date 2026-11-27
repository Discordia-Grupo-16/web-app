/** What others see of a user (SCRUM-27). An invisible user shows up as `offline`. */
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

/** The status the user sets by hand; `null` goes back to the automatic one. */
export type ManualPresence = 'dnd' | 'invisible' | null;

export interface MemberPresence {
    userId: string;
    status: PresenceStatus;
    /** When `chat` saved the status. A state is applied only if it is newer than the one held. */
    updatedAt: string;
}
