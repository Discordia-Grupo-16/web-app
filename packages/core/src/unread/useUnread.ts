import { useContext, useEffect } from 'react';
import { UnreadContext, type UnreadContextValue } from './unreadContext';
import {
    channelMentionCount,
    hasAnyUnread,
    isChannelUnread,
    isServerUnread,
    serverMentionCount,
} from './unreadStore';

export interface UnreadIndicator {
    unread: boolean;
    /** Always 0 until the optional "Menciones" story exists. */
    mentionCount: number;
}

const NONE: UnreadIndicator = { unread: false, mentionCount: 0 };

// Without a provider the hooks read as "nothing unread" instead of throwing, like `useServerEvents`
// does without realtime: a screen does not break because the indicators are not mounted.

export const useChannelUnread = (channelId: string): UnreadIndicator => {
    const context = useContext(UnreadContext);
    if (!context) return NONE;
    return { unread: isChannelUnread(context.state, channelId), mentionCount: channelMentionCount(context.state, channelId) };
};

/** A server is unread when any of its channels is. */
export const useServerUnread = (serverId: string): UnreadIndicator => {
    const context = useContext(UnreadContext);
    if (!context) return NONE;
    return { unread: isServerUnread(context.state, serverId), mentionCount: serverMentionCount(context.state, serverId) };
};

/** Whether anything at all is unread, and the action that clears it. */
export const useMarkAllRead = (): { anyUnread: boolean; markAllRead: () => Promise<void> } => {
    const context = useContext(UnreadContext);
    return {
        anyUnread: context ? hasAnyUnread(context.state) : false,
        markAllRead: context ? context.markAllRead : async () => {},
    };
};

/**
 * Marks the channel as read while the user is looking at it. `visible` is the platform's call: on
 * the web, the tab is shown; on mobile, the screen is focused and the app is in the foreground.
 * A channel in a hidden tab is not read, so what arrives there is still news when the user returns.
 */
export const useMarkChannelRead = (channelId: string, visible: boolean): void => {
    const setActiveChannel: UnreadContextValue['setActiveChannel'] | undefined = useContext(UnreadContext)?.setActiveChannel;
    useEffect(() => {
        if (!setActiveChannel) return;
        setActiveChannel(channelId, visible);
        return () => setActiveChannel(null, false);
    }, [setActiveChannel, channelId, visible]);
};
