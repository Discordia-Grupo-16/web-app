import { useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { ReadStatesService } from '@discordia/api';
import { RealtimeContext } from '../chat/realtimeContext';
import type { Logger } from '../chat/useRealtimeController';
import type { UnreadContextValue } from './unreadContext';
import { initialUnreadState, unreadReducer } from './unreadStore';

/**
 * Reads of the open channel go out at most this often. Without it a busy channel would send one
 * request per message; the request is idempotent, so waiting costs nothing but a second of delay
 * on the other sessions.
 */
export const MARK_READ_GROUP_MS = 1000;

export interface UnreadControllerOptions {
    service: Pick<ReadStatesService, 'getUnread' | 'markRead' | 'markAllRead'>;
    /** null while there is no session: nothing is loaded and what was loaded is dropped. */
    userId: string | null;
    logger: Logger;
}

/**
 * Keeps the unread state of the user: loads it, applies the messages and the reads that arrive
 * over the socket, and reports to the server what the user reads. It works without a realtime
 * provider, but then nothing pushes changes and the state is only the one loaded at the start.
 */
export const useUnreadController = ({ service, userId, logger }: UnreadControllerOptions): UnreadContextValue => {
    const realtime = useContext(RealtimeContext);
    const subscribeMessages = realtime?.onMessageCreated;
    const subscribeReads = realtime?.onReadStateUpdated;
    const subscribeReconnects = realtime?.onReconnect;

    const [state, dispatch] = useReducer(unreadReducer, initialUnreadState);

    const stateRef = useRef(state);
    const active = useRef<{ channelId: string | null; visible: boolean }>({ channelId: null, visible: false });
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inFlight = useRef(new Set<string>());
    const loadSeq = useRef(0);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const reportRef = useRef<(channelId: string) => Promise<void>>(async () => {});

    const cancelTimer = useCallback(() => {
        if (timer.current === null) return;
        clearTimeout(timer.current);
        timer.current = null;
    }, []);

    const scheduleReport = useCallback(() => {
        if (timer.current !== null) return;
        timer.current = setTimeout(() => {
            timer.current = null;
            const { channelId, visible } = active.current;
            if (channelId && visible) void reportRef.current(channelId);
        }, MARK_READ_GROUP_MS);
    }, []);

    // Reports the channel as read up to its last message, unless that is already so or a request
    // for it is on its way.
    const report = useCallback(
        async (channelId: string) => {
            const entry = stateRef.current.byChannel[channelId];
            if (!entry || inFlight.current.has(channelId)) return;
            if (entry.lastReadMessageId === entry.lastMessageId) return;
            inFlight.current.add(channelId);
            try {
                // The answer is the current state, which can be ahead of what was asked.
                const current = await service.markRead(channelId, entry.lastMessageId);
                dispatch({ type: 'readStateUpdated', states: [current] });
            } catch (err) {
                logger.error('markRead failed', channelId, err);
            } finally {
                inFlight.current.delete(channelId);
                // A message that came in while the request was on its way was skipped: report it too.
                const { channelId: open, visible } = active.current;
                if (open === channelId && visible && stateRef.current.byChannel[channelId]?.lastMessageId !== entry.lastMessageId) {
                    scheduleReport();
                }
            }
        },
        [service, logger, scheduleReport],
    );
    useEffect(() => {
        reportRef.current = report;
    });

    const load = useCallback(async () => {
        const seq = ++loadSeq.current;
        try {
            const items = await service.getUnread();
            // Only the latest request counts: an older answer can be behind the state.
            if (seq === loadSeq.current) dispatch({ type: 'loaded', items });
        } catch (err) {
            logger.error('load unread failed', err);
        }
    }, [service, logger]);

    useEffect(() => {
        if (!userId) {
            loadSeq.current++;
            dispatch({ type: 'reset' });
            return;
        }
        void load();
        return () => {
            loadSeq.current++;
        };
    }, [userId, load]);

    useEffect(() => {
        if (!userId || !subscribeMessages || !subscribeReads || !subscribeReconnects) return;

        const offMessages = subscribeMessages((frame) => {
            const open = active.current.channelId === frame.channelId && active.current.visible;
            dispatch({ type: 'messageCreated', frame, me: userId, suppress: open });
            if (open && frame.authorId !== userId) scheduleReport();
        });
        const offReads = subscribeReads((frame) => dispatch({ type: 'readStateUpdated', states: frame.states }));
        // The messages and reads that went by while the socket was down are lost.
        const offReconnects = subscribeReconnects(() => void load());

        return () => {
            offMessages();
            offReads();
            offReconnects();
        };
    }, [userId, subscribeMessages, subscribeReads, subscribeReconnects, scheduleReport, load]);

    // Whatever loads or arrives for the channel the user is looking at is read as it comes.
    useEffect(() => {
        const { channelId, visible } = active.current;
        if (channelId && visible && state.byChannel[channelId]?.unread) scheduleReport();
    }, [state, scheduleReport]);

    const setActiveChannel = useCallback<UnreadContextValue['setActiveChannel']>(
        (channelId, visible) => {
            const previous = active.current;
            active.current = { channelId, visible };
            // What arrived in a channel the user was looking at was seen: report it now instead of
            // losing it when the channel closes or the tab is hidden.
            if (timer.current !== null && (previous.channelId !== channelId || !visible)) {
                cancelTimer();
                if (previous.channelId && previous.visible) void report(previous.channelId);
            }
            if (channelId && visible) void report(channelId);
        },
        [report, cancelTimer],
    );

    useEffect(() => cancelTimer, [cancelTimer]);

    const markAllRead = useCallback(async () => {
        const changed = await service.markAllRead();
        // The states the server answered, not "everything": a message that arrived after the
        // server built the answer must stay unread.
        dispatch({ type: 'readStateUpdated', states: changed });
    }, [service]);

    return useMemo(() => ({ state, setActiveChannel, markAllRead }), [state, setActiveChannel, markAllRead]);
};
