import { createContext } from 'react';
import type { ChatState } from './chatStore';
import type {
    ConnectionState,
    InvalidateFrame,
    MessageCreatedFrame,
    PresenceFrame,
    ReadStateUpdatedFrame,
    VoiceParticipantsUpdatedFrame,
} from '@discordia/api';

export type RealtimeStatus = ConnectionState | 'disabled';

export interface RejectedMessage {
    channelId: string;
    content: string;
    code: 'EMPTY_MESSAGE' | 'MESSAGE_TOO_LONG';
    message: string;
}

export interface RealtimeContextValue {
    status: RealtimeStatus;
    state: ChatState;
    maxLength: number;
    send: (channelId: string, content: string) => void;
    retry: (clientMessageId: string) => void;
    discard: (clientMessageId: string) => void;
    lastRejected: RejectedMessage | null;
    clearRejected: () => void;
    /**
     * Edits one of the user's own messages (SCRUM-44). Resolves when it is saved and already applied
     * to the list; rejects with the HTTP error, which `editErrorText` turns into text.
     */
    editMessage: (channelId: string, messageId: string, content: string) => Promise<void>;
    /**
     * Deletes a message: the user's own, or someone else's with MANAGE_MESSAGES (SCRUM-45). Resolves
     * when it is deleted and already out of the list; rejects with the HTTP error (`deleteErrorText`).
     */
    deleteMessage: (channelId: string, messageId: string) => Promise<void>;
    /**
     * Adds (`reacted: true`) or removes the user's reaction with that emoji (SCRUM-49). The caller
     * decides from what the user sees: the chip that is already theirs removes, any other adds.
     * Resolves when the server answered and the new state is already applied, without waiting for
     * the frame; rejects with the HTTP error (`reactionErrorText`). A second call for the same
     * message and emoji while the first is in flight gets the same promise and sends nothing.
     */
    setReaction: (channelId: string, messageId: string, emoji: string, reacted: boolean) => Promise<void>;
    loadHistory: (channelId: string) => void;
    retryHistory: (channelId: string) => void;
    loadMoreHistory: (channelId: string, beforeId: string) => void;
    /**
     * Subscribes to the notices that something the client has loaded went stale (ADR-0017). Hooks
     * go through here so none of them touches the RealtimeClient. Returns the unsubscribe function.
     */
    onInvalidate: (handler: (frame: InvalidateFrame) => void) => () => void;
    /**
     * Subscribes to the frames that say who is connected to a voice channel (SCRUM-54). They carry
     * the data, unlike the notices above. A frame of any server arrives: the subscriber filters by
     * server and by `syncedAt`. Returns the unsubscribe function.
     */
    onVoiceParticipants: (handler: (frame: VoiceParticipantsUpdatedFrame) => void) => () => void;
    /**
     * Subscribes to the changes of activity status (SCRUM-27) of whoever shares a server with the
     * user. The subscriber orders them by `updatedAt`. Returns the unsubscribe function.
     */
    onPresence: (handler: (frame: PresenceFrame) => void) => () => void;
    /** Says whether the user is idle (SCRUM-27). Safe to call with the socket closed. */
    sendActivity: (idle: boolean) => void;
    /**
     * Subscribes to the messages other sessions and users send, for what is not the message list
     * itself (the unread indicators). Returns the unsubscribe function.
     */
    onMessageCreated: (handler: (frame: MessageCreatedFrame) => void) => () => void;
    /**
     * Subscribes to the user's reads made in another session. Returns the unsubscribe function.
     */
    onReadStateUpdated: (handler: (frame: ReadStateUpdatedFrame) => void) => () => void;
    /**
     * Subscribes to the socket coming back after it had been open before: a reconnection, or the
     * app returning from the background. Notices that went by in the meantime are lost (the bus has
     * no replay), so whoever listens refetches everything it has loaded. It does not fire on the
     * first open. Returns the unsubscribe function.
     */
    onReconnect: (handler: () => void) => () => void;
}

export const DEFAULT_MAX_LENGTH = 2000;

export const RealtimeContext = createContext<RealtimeContextValue | null>(null);
