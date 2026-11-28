import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MAX_TIMEOUT_MS } from '../moderation/mute';
import { NO_LOCAL_MUTES, NO_SPEAKERS, toggleId } from './participants';
import { canRejoin } from './texts';
import type {
    CameraResult,
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

// chat answers how long is left; the timer waits half a second more so the mute is over when it asks again.
const PERMISSION_REFRESH_MARGIN_MS = 500;
// A request for the permission that fails is repeated once, after this.
const PERMISSION_RETRY_MS = 5000;

const micState = (mic: MicResult, muted: boolean) => {
    const micAvailable = mic === 'ok';
    return { micAvailable, micBlocked: mic === 'blocked', muted: micAvailable ? muted : true, micPending: false };
};

// An intentional mute: the microphone is there and the user turned it off.
const intentionallyMuted = (call: ConnectedCall) => call.micAvailable && call.muted;

// The call and the join attempt are separate: a rejected attempt never touches the active call.
// The current room is left only once the new token is in hand.
export const useVoiceController = ({ adapter, requestToken, refreshPermissions: requestPermissions }: VoiceControllerOptions): VoiceController => {
    const [call, setCall] = useState<VoiceCall>({ status: 'idle' });
    const [attempt, setAttempt] = useState<VoiceJoinAttempt | null>(null);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [speakers, setSpeakers] = useState<ReadonlySet<string>>(NO_SPEAKERS);
    const [locallyMuted, setLocallyMuted] = useState<ReadonlySet<string>>(NO_LOCAL_MUTES);

    // Mirrors of the state for the async flow, which outlives the render that started it.
    const callRef = useRef(call);
    const attemptRef = useRef(attempt);
    const participantsRef = useRef<VoiceParticipant[]>([]);
    const locallyMutedRef = useRef(locallyMuted);
    // While switching rooms, the exit from the previous one (own or forced by chat) is not shown.
    const switchingRef = useRef(false);
    // A disconnection hidden by the switch, shown after all if the switch fails before leaving the room.
    const hiddenDisconnectRef = useRef<RoomDisconnectInfo | null>(null);
    // Each join takes a number. Leaving the session or the app bumps it, and a join that sees another
    // number after an await stops without touching the state.
    const joinIdRef = useRef(0);
    // Each microphone request takes a number too, so a late answer does not touch a newer call.
    const micRequestRef = useRef(0);
    // Each camera request takes a number too, so a late answer does not touch a newer call.
    const cameraRequestRef = useRef(0);
    // Whether the call that was cut was muted on purpose: "Volver a unirse" keeps it.
    const rememberedMuteRef = useRef(false);
    // The timer that asks chat for the permission when a mute should be over, and the number of the
    // request in flight: cancelling takes a new one, so an answer that comes late is dropped.
    const permissionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const permissionRequestRef = useRef(0);

    const updateCall = useCallback((next: VoiceCall) => {
        callRef.current = next;
        setCall(next);
    }, []);
    const updateAttempt = useCallback((next: VoiceJoinAttempt | null) => {
        attemptRef.current = next;
        setAttempt(next);
    }, []);
    const updateLocallyMuted = useCallback((next: ReadonlySet<string>) => {
        locallyMutedRef.current = next;
        setLocallyMuted(next);
    }, []);

    const cancelPermissionRefresh = useCallback(() => {
        permissionRequestRef.current += 1;
        if (permissionTimerRef.current !== null) clearTimeout(permissionTimerRef.current);
        permissionTimerRef.current = null;
    }, []);

    // chat does not trust the client: it checks its own copy of the mute and applies the result in LiveKit,
    // so asking early is harmless. The answer says how long is left, and the next ask waits for that. The
    // end of the mute itself comes through the adapter, once LiveKit gives the permission back.
    const refreshPermissions = useCallback(
        function run(channelId: string, isRetry = false) {
            cancelPermissionRefresh();
            const requestId = permissionRequestRef.current;
            const wait = (delayMs: number, retry: boolean) => {
                permissionTimerRef.current = setTimeout(() => {
                    permissionTimerRef.current = null;
                    run(channelId, retry);
                }, Math.min(delayMs, MAX_TIMEOUT_MS));
            };
            requestPermissions(channelId).then(
                (state) => {
                    const current = callRef.current;
                    if (permissionRequestRef.current !== requestId) return;
                    if (current.status !== 'connected' || current.channel.id !== channelId) return;
                    if (state.canPublish) return;
                    updateCall({ ...current, serverMutedUntil: state.mutedUntil });
                    // Still muted: it may be early, or a mute longer than a timer can wait (then chat says how
                    // much is left again when it asks).
                    wait(state.remainingSeconds * 1000 + PERMISSION_REFRESH_MARGIN_MS, false);
                },
                () => {
                    if (permissionRequestRef.current !== requestId || isRetry) return;
                    wait(PERMISSION_RETRY_MS, true);
                },
            );
        },
        [cancelPermissionRefresh, requestPermissions, updateCall],
    );

    useEffect(() => {
        if (!adapter) return;
        const unsubscribers = [
            adapter.onParticipantsChanged((snapshot) => {
                participantsRef.current = snapshot;
                const current = callRef.current;
                if (current.status === 'connected') updateCall({ ...current, participants: snapshot });
            }),
            adapter.onActiveSpeakersChanged(setSpeakers),
            adapter.onDisconnected((info) => {
                const current = callRef.current;
                if (current.status !== 'connected') return;
                if (switchingRef.current) {
                    hiddenDisconnectRef.current = info;
                    return;
                }
                cancelPermissionRefresh();
                cameraRequestRef.current += 1;
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
            adapter.onPublishPermissionChanged((canPublish) => {
                const current = callRef.current;
                if (current.status !== 'connected') return;
                if (canPublish) {
                    // The microphone stays off: turning it on is for the user, with the button.
                    cancelPermissionRefresh();
                    if (current.serverMuted) updateCall({ ...current, serverMuted: false, serverMutedUntil: null });
                    return;
                }
                // LiveKit already unpublished the track; an answer of the microphone still in flight must not turn it on.
                micRequestRef.current += 1;
                // LiveKit unpublished the camera too (C1): a camera answer still in flight must not count.
                cameraRequestRef.current += 1;
                updateCall({ ...current, serverMuted: true, muted: true, micPending: false, cameraPending: false });
                refreshPermissions(current.channel.id);
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
    }, [adapter, updateCall, cancelPermissionRefresh, refreshPermissions]);

    // Leaving the session (logout) closes the room and stops a join in progress.
    useEffect(
        () => () => {
            joinIdRef.current += 1;
            micRequestRef.current += 1;
            cameraRequestRef.current += 1;
            cancelPermissionRefresh();
            if (adapter && callRef.current.status === 'connected') void adapter.disconnect();
        },
        [adapter, cancelPermissionRefresh],
    );

    const startJoin = useCallback(
        (channel: VoiceChannelRef, micPlan: MicPlan, keepLocalMutes = false) => {
            if (!adapter) return;
            const previous = callRef.current;
            rememberedMuteRef.current = false;
            micRequestRef.current += 1;
            cameraRequestRef.current += 1;
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
                        cancelPermissionRefresh();
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
                    cancelPermissionRefresh();
                    // The old room is gone from here on. A join from scratch starts with nobody muted; "Volver a
                    // unirse" keeps them. Either way the adapter gets the whole set before connecting, so the first
                    // audio of a muted participant already plays at volume 0.
                    if (!keepLocalMutes) updateLocallyMuted(NO_LOCAL_MUTES);
                    adapter.setLocallyMuted(locallyMutedRef.current);
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
                const base = {
                    status: 'connected' as const,
                    channel,
                    reconnecting: false,
                    participants: participantsRef.current,
                    serverMuted: false,
                    serverMutedUntil: null,
                    // The camera always starts off, and nothing asks for it on joining (C11).
                    cameraPending: false,
                    cameraProblem: null,
                };
                // Muted by a moderator at the door: the token came without the right to publish, so there is
                // nothing to ask the system for. No event will tell how long it lasts, so chat is asked.
                if (!adapter.canPublish()) {
                    const noMic = micPlan.kind === 'none';
                    updateCall({
                        ...base,
                        micAvailable: !noMic,
                        micBlocked: noMic && micPlan.micBlocked,
                        muted: true,
                        micPending: false,
                        serverMuted: true,
                    });
                    updateAttempt(null);
                    refreshPermissions(channel.id);
                    return;
                }
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
        [adapter, requestToken, cancelPermissionRefresh, refreshPermissions, updateAttempt, updateCall, updateLocallyMuted],
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
        startJoin(current.channel, rememberedMuteRef.current ? { kind: 'muted' } : { kind: 'on' }, true);
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
        updateLocallyMuted(NO_LOCAL_MUTES);
        if (callRef.current.status === 'disconnected') updateCall({ status: 'idle' });
    }, [updateAttempt, updateCall, updateLocallyMuted]);

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
            cameraRequestRef.current += 1;
            switchingRef.current = false;
            cancelPermissionRefresh();
            if (joining) updateAttempt(null);
            participantsRef.current = [];
            rememberedMuteRef.current = current.status === 'connected' && intentionallyMuted(current);
            updateCall({ status: 'disconnected', channel, reason });
            if (current.status === 'connected') void adapter.disconnect();
        },
        [adapter, cancelPermissionRefresh, updateAttempt, updateCall],
    );

    // The state goes first, so the client-initiated disconnection finds the call idle and is not shown
    // as a cut. A join in progress is not cancelled.
    const leave = useCallback(() => {
        const current = callRef.current;
        if (!adapter || current.status !== 'connected' || attemptRef.current?.status === 'connecting') return;
        participantsRef.current = [];
        micRequestRef.current += 1;
        cameraRequestRef.current += 1;
        cancelPermissionRefresh();
        rememberedMuteRef.current = false;
        updateLocallyMuted(NO_LOCAL_MUTES);
        updateCall({ status: 'idle' });
        void adapter.disconnect();
    }, [adapter, cancelPermissionRefresh, updateCall, updateLocallyMuted]);

    // Muting is immediate. Turning the microphone on waits for its answer: the control shows it is
    // active only once the system gave it. Muted by a moderator, there is nothing to toggle.
    const toggleMute = useCallback(() => {
        const current = callRef.current;
        if (!adapter || current.status !== 'connected' || current.micPending || current.serverMuted) return;
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

    // On the server it is a mute of the camera track; the microphone and the room are not touched (C2).
    // Turning it on waits for its answer, like the microphone; a muted-by-moderator call cannot (C1).
    const toggleCamera = useCallback(() => {
        const current = callRef.current;
        if (!adapter || current.status !== 'connected' || current.cameraPending || current.serverMuted) return;
        if (attemptRef.current?.status === 'connecting') return;
        const cameraOn = current.participants.find((p) => p.isLocal)?.cameraOn ?? false;
        const requestId = ++cameraRequestRef.current;
        updateCall({ ...current, cameraPending: true, cameraProblem: null });
        const request: Promise<CameraResult> = cameraOn
            ? adapter.disableCamera().then((): CameraResult => 'ok')
            : adapter.enableCamera();
        void request
            .catch((): CameraResult => 'unavailable')
            .then((result) => {
                const latest = callRef.current;
                if (cameraRequestRef.current !== requestId || latest.status !== 'connected') return;
                updateCall({ ...latest, cameraPending: false, cameraProblem: result === 'ok' ? null : result });
            });
    }, [adapter, updateCall]);

    // Only on this device: the adapter turns the volume of that participant down or back up.
    const toggleLocalMute = useCallback(
        (userId: string) => {
            const current = callRef.current;
            if (!adapter || current.status !== 'connected' || attemptRef.current?.status === 'connecting') return;
            const participant = current.participants.find((p) => p.userId === userId);
            if (!participant || participant.isLocal) return;
            const next = toggleId(locallyMutedRef.current, userId);
            updateLocallyMuted(next);
            adapter.setLocallyMuted(next);
        },
        [adapter, updateLocallyMuted],
    );

    const connected = call.status === 'connected';

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
            toggleCamera,
            locallyMuted: connected ? locallyMuted : NO_LOCAL_MUTES,
            toggleLocalMute,
            retry,
            dismiss,
            startAudio,
        }),
        [
            call,
            attempt,
            adapter,
            audioBlocked,
            join,
            rejoin,
            leave,
            toggleMute,
            toggleCamera,
            connected,
            locallyMuted,
            toggleLocalMute,
            retry,
            dismiss,
            startAudio,
        ],
    );

    // Outside a connected call nobody is speaking, whatever the adapter said last. The memo keeps the
    // reference while nothing changes, so the readers of the context do not re-render.
    const speakingIds = useMemo(() => (connected ? speakers : NO_SPEAKERS), [connected, speakers]);

    return { value, speakingIds, disconnectWithReason };
};
