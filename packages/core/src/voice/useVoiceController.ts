import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canRejoin } from './texts';
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

// What the new room does with the microphone, decided from the call there was before.
type MicPlan = { kind: 'on' } | { kind: 'muted' } | { kind: 'none'; micBlocked: boolean };

type ConnectedCall = Extract<VoiceCall, { status: 'connected' }>;

const micState = (mic: MicResult, muted: boolean) => {
    const micAvailable = mic === 'ok';
    return { micAvailable, micBlocked: mic === 'blocked', muted: micAvailable ? muted : true, micPending: false };
};

// An intentional mute: the microphone is there and the user turned it off.
const intentionallyMuted = (call: ConnectedCall) => call.micAvailable && call.muted;

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
    // Each microphone request takes a number too, so a late answer does not touch a newer call.
    const micRequestRef = useRef(0);
    // Whether the call that was cut was muted on purpose: "Volver a unirse" keeps it.
    const rememberedMuteRef = useRef(false);

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
                rememberedMuteRef.current = intentionallyMuted(current);
                updateCall({ status: 'disconnected', channel: current.channel, reason: disconnectReason(info) });
            }),
            adapter.onMicrophoneLost((cause) => {
                const current = callRef.current;
                if (current.status !== 'connected') return;
                micRequestRef.current += 1;
                updateCall({ ...current, micAvailable: false, micBlocked: cause === 'blocked', muted: true, micPending: false });
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
            micRequestRef.current += 1;
            if (adapter && callRef.current.status === 'connected') void adapter.disconnect();
        },
        [adapter],
    );

    const startJoin = useCallback(
        (channel: VoiceChannelRef, micPlan: MicPlan) => {
            if (!adapter) return;
            const previous = callRef.current;
            rememberedMuteRef.current = false;
            micRequestRef.current += 1;
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
                        rememberedMuteRef.current = intentionallyMuted(current);
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

                // The call is in the new room from here on. Without a microphone it stays that way and
                // the permission is not asked again; otherwise it is muted until the microphone answers.
                const base = { status: 'connected' as const, channel, reconnecting: false, participants: participantsRef.current };
                if (micPlan.kind === 'none') {
                    updateCall({ ...base, micAvailable: false, micBlocked: micPlan.micBlocked, muted: true, micPending: false });
                    updateAttempt(null);
                    return;
                }
                updateCall({ ...base, micAvailable: true, micBlocked: false, muted: true, micPending: true });
                updateAttempt(null);

                const requestId = ++micRequestRef.current;
                const request = micPlan.kind === 'muted' ? adapter.enableMicrophone({ muted: true }) : adapter.enableMicrophone();
                const mic: MicResult = await request.catch((): MicResult => 'no-device');
                const current = callRef.current;
                // The call may have ended, or moved on, while the system was asking.
                if (micRequestRef.current !== requestId || current.status !== 'connected' || current.channel.id !== channel.id) {
                    return;
                }
                updateCall({ ...current, ...micState(mic, micPlan.kind === 'muted') });
            })();
        },
        [adapter, requestToken, updateAttempt, updateCall],
    );

    // A channel's "Unirse". Switching rooms keeps the microphone as it was; from no call it starts on.
    const join = useCallback(
        (channel: VoiceChannelRef) => {
            if (!adapter || attemptRef.current?.status === 'connecting') return;
            const previous = callRef.current;
            if (previous.status === 'connected' && previous.channel.id === channel.id) return;
            let micPlan: MicPlan = { kind: 'on' };
            if (previous.status === 'connected') {
                if (!previous.micAvailable) micPlan = { kind: 'none', micBlocked: previous.micBlocked };
                else if (previous.muted) micPlan = { kind: 'muted' };
            }
            startJoin(channel, micPlan);
        },
        [adapter, startJoin],
    );

    const rejoin = useCallback(() => {
        const current = callRef.current;
        if (!adapter || attemptRef.current?.status === 'connecting') return;
        if (current.status !== 'disconnected' || !canRejoin(current.reason)) return;
        startJoin(current.channel, rememberedMuteRef.current ? { kind: 'muted' } : { kind: 'on' });
    }, [adapter, startJoin]);

    const retry = useCallback(() => {
        const current = attemptRef.current;
        if (current?.status !== 'failed' || !RETRYABLE.has(current.error)) return;
        updateAttempt(null);
        join(current.channel);
    }, [join, updateAttempt]);

    const dismiss = useCallback(() => {
        if (attemptRef.current?.status === 'failed') updateAttempt(null);
        rememberedMuteRef.current = false;
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
            micRequestRef.current += 1;
            switchingRef.current = false;
            if (joining) updateAttempt(null);
            participantsRef.current = [];
            rememberedMuteRef.current = current.status === 'connected' && intentionallyMuted(current);
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
        micRequestRef.current += 1;
        rememberedMuteRef.current = false;
        updateCall({ status: 'idle' });
        void adapter.disconnect();
    }, [adapter, updateCall]);

    // Muting is immediate. Turning the microphone on waits for its answer: the control shows it is
    // active only once the system gave it.
    const toggleMute = useCallback(() => {
        const current = callRef.current;
        if (!adapter || current.status !== 'connected' || current.micPending) return;
        if (attemptRef.current?.status === 'connecting') return;
        if (current.micAvailable && !current.muted) {
            updateCall({ ...current, muted: true });
            void adapter.muteMicrophone();
            return;
        }
        const requestId = ++micRequestRef.current;
        updateCall({ ...current, micPending: true });
        void adapter
            .enableMicrophone()
            .catch((): MicResult => 'no-device')
            .then((mic) => {
                const latest = callRef.current;
                if (micRequestRef.current !== requestId || latest.status !== 'connected') return;
                updateCall({ ...latest, ...micState(mic, false) });
            });
    }, [adapter, updateCall]);

    const value = useMemo(
        () => ({
            call,
            attempt,
            available: adapter !== null,
            audioBlocked,
            join,
            rejoin,
            leave,
            toggleMute,
            retry,
            dismiss,
            startAudio,
        }),
        [call, attempt, adapter, audioBlocked, join, rejoin, leave, toggleMute, retry, dismiss, startAudio],
    );

    return { value, disconnectWithReason };
};
