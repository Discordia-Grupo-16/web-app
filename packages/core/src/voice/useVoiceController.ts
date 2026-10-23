import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    MicResult,
    RoomConnectFailure,
    RoomDisconnectInfo,
    VoiceCall,
    VoiceChannelRef,
    VoiceClientReason,
    VoiceController,
    VoiceControllerOptions,
    VoiceDisconnectReason,
    VoiceJoinAttempt,
    VoiceJoinError,
    VoiceParticipant,
} from './types';

export type { VoiceContextValue, VoiceController, VoiceControllerOptions } from './types';

const RETRYABLE: ReadonlySet<VoiceJoinError> = new Set<VoiceJoinError>(['unavailable', 'network']);

// The token endpoint has no own error type: the status is what tells the cases apart.
const tokenError = (error: unknown): VoiceJoinError => {
    const status = (error as { response?: { status?: number } } | null)?.response?.status;
    if (status === undefined) return 'network';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not-found';
    if (status === 422) return 'not-voice';
    return 'unavailable';
};

const connectError = (error: unknown): VoiceJoinError => {
    const kind = (error as { kind?: RoomConnectFailure } | null)?.kind;
    return kind === 'network' ? 'network' : 'unavailable';
};

// The reason written by chat wins; without it, LiveKit's cause is the generic fallback.
const disconnectReason = (info: RoomDisconnectInfo): VoiceDisconnectReason => {
    if (info.serverReason) return info.serverReason;
    if (info.cause === 'duplicate_identity') return 'other_device';
    if (info.cause === 'room_deleted') return 'channel_deleted';
    return 'connection_lost';
};

// The call and the join attempt are separate: a rejected attempt never touches the active call.
// The current room is left only once the new token is in hand.
export const useVoiceController = ({ adapter, requestToken }: VoiceControllerOptions): VoiceController => {
    const [call, setCall] = useState<VoiceCall>({ status: 'idle' });
    const [attempt, setAttempt] = useState<VoiceJoinAttempt | null>(null);
    const [audioBlocked, setAudioBlocked] = useState(false);

    // Mirrors of the state for the async flow, which outlives the render that started it.
    const callRef = useRef(call);
    const attemptRef = useRef(attempt);
    const participantsRef = useRef<VoiceParticipant[]>([]);
    // While switching rooms, the exit from the previous one (own or forced by chat) is not shown.
    const switchingRef = useRef(false);
    // A disconnection hidden by the switch, shown after all if the switch fails before leaving the room.
    const hiddenDisconnectRef = useRef<RoomDisconnectInfo | null>(null);
    // Each join takes a number. Leaving the session or the app bumps it, and a join that sees another
    // number after an await stops without touching the state.
    const joinIdRef = useRef(0);

    const updateCall = useCallback((next: VoiceCall) => {
        callRef.current = next;
        setCall(next);
    }, []);
    const updateAttempt = useCallback((next: VoiceJoinAttempt | null) => {
        attemptRef.current = next;
        setAttempt(next);
    }, []);

    useEffect(() => {
        if (!adapter) return;
        const unsubscribers = [
            adapter.onParticipantsChanged((snapshot) => {
                participantsRef.current = snapshot;
                const current = callRef.current;
                if (current.status === 'connected') updateCall({ ...current, participants: snapshot });
            }),
            adapter.onDisconnected((info) => {
                const current = callRef.current;
                if (current.status !== 'connected') return;
                if (switchingRef.current) {
                    hiddenDisconnectRef.current = info;
                    return;
                }
                participantsRef.current = [];
                updateCall({ status: 'disconnected', channel: current.channel, reason: disconnectReason(info) });
            }),
            adapter.onReconnectingChanged((reconnecting) => {
                const current = callRef.current;
                if (current.status === 'connected' && current.reconnecting !== reconnecting) {
                    updateCall({ ...current, reconnecting });
                }
            }),
        ];
        if (adapter.onAudioPlaybackBlocked) unsubscribers.push(adapter.onAudioPlaybackBlocked(setAudioBlocked));
        return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    }, [adapter, updateCall]);

    // Leaving the session (logout) closes the room and stops a join in progress.
    useEffect(
        () => () => {
            joinIdRef.current += 1;
            if (adapter && callRef.current.status === 'connected') void adapter.disconnect();
        },
        [adapter],
    );

    const join = useCallback(
        (channel: VoiceChannelRef) => {
            if (!adapter || attemptRef.current?.status === 'connecting') return;
            const previous = callRef.current;
            if (previous.status === 'connected' && previous.channel.id === channel.id) return;

            const joinId = ++joinIdRef.current;
            const stopped = () => joinIdRef.current !== joinId;
            updateAttempt({ status: 'connecting', channel });
            // chat removes the user from the previous room as soon as it signs the new token.
            switchingRef.current = previous.status === 'connected';
            hiddenDisconnectRef.current = null;
            void (async () => {
                let token;
                try {
                    token = await requestToken(channel.id);
                } catch (error) {
                    if (stopped()) return;
                    switchingRef.current = false;
                    const hidden = hiddenDisconnectRef.current;
                    const current = callRef.current;
                    if (hidden && current.status === 'connected') {
                        participantsRef.current = [];
                        updateCall({ status: 'disconnected', channel: current.channel, reason: disconnectReason(hidden) });
                    }
                    updateAttempt({ status: 'failed', channel, error: tokenError(error) });
                    return;
                }
                if (stopped()) return;

                try {
                    if (callRef.current.status === 'connected') {
                        await adapter.disconnect();
                        participantsRef.current = [];
                        if (stopped()) return;
                    }
                    await adapter.connect(token.url, token.token);
                } catch (error) {
                    if (stopped()) return;
                    updateCall({ status: 'idle' });
                    updateAttempt({ status: 'failed', channel, error: connectError(error) });
                    return;
                } finally {
                    if (!stopped()) switchingRef.current = false;
                }
                // The room opened after the join was stopped: nobody is going to use it.
                if (stopped()) {
                    void adapter.disconnect();
                    return;
                }

                // The call is in the new room from here on, even while the system asks for the
                // microphone: muted, and without the no-microphone warning until the answer comes.
                updateCall({
                    status: 'connected',
                    channel,
                    micAvailable: true,
                    micBlocked: false,
                    muted: true,
                    reconnecting: false,
                    participants: participantsRef.current,
                });
                updateAttempt(null);

                const mic: MicResult = await adapter.enableMicrophone().catch((): MicResult => 'no-device');
                const current = callRef.current;
                // The call may have ended while the system was asking.
                if (current.status !== 'connected' || current.channel.id !== channel.id) return;
                const micAvailable = mic === 'ok';
                updateCall({ ...current, micAvailable, micBlocked: mic === 'blocked', muted: !micAvailable });
            })();
        },
        [adapter, requestToken, updateAttempt, updateCall],
    );

    const retry = useCallback(() => {
        const current = attemptRef.current;
        if (current?.status !== 'failed' || !RETRYABLE.has(current.error)) return;
        updateAttempt(null);
        join(current.channel);
    }, [join, updateAttempt]);

    const dismiss = useCallback(() => {
        if (attemptRef.current?.status === 'failed') updateAttempt(null);
        if (callRef.current.status === 'disconnected') updateCall({ status: 'idle' });
    }, [updateAttempt, updateCall]);

    const startAudio = useCallback(() => {
        void adapter?.startAudio?.();
    }, [adapter]);

    const disconnectWithReason = useCallback(
        (reason: VoiceClientReason) => {
            const current = callRef.current;
            const joining = attemptRef.current?.status === 'connecting' ? attemptRef.current : null;
            const channel = current.status === 'connected' ? current.channel : joining?.channel;
            if (!adapter || !channel) return;
            joinIdRef.current += 1;
            switchingRef.current = false;
            if (joining) updateAttempt(null);
            participantsRef.current = [];
            updateCall({ status: 'disconnected', channel, reason });
            if (current.status === 'connected') void adapter.disconnect();
        },
        [adapter, updateAttempt, updateCall],
    );

    // The state goes first, so the client-initiated disconnection finds the call idle and is not shown
    // as a cut. A join in progress is not cancelled.
    const leave = useCallback(() => {
        const current = callRef.current;
        if (!adapter || current.status !== 'connected' || attemptRef.current?.status === 'connecting') return;
        participantsRef.current = [];
        updateCall({ status: 'idle' });
        void adapter.disconnect();
    }, [adapter, updateCall]);

    const value = useMemo(
        () => ({ call, attempt, available: adapter !== null, audioBlocked, join, leave, retry, dismiss, startAudio }),
        [call, attempt, adapter, audioBlocked, join, leave, retry, dismiss, startAudio],
    );

    return { value, disconnectWithReason };
};
