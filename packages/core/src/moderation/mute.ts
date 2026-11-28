import { useEffect, useState } from 'react';

// The durations a moderator can pick when muting a member (SCRUM-71). The backend accepts anything
// between 60 seconds and 28 days; these are the ones the dialog offers.
export const MUTE_DURATIONS = [
    { seconds: 60, label: '60 segundos' },
    { seconds: 5 * 60, label: '5 minutos' },
    { seconds: 10 * 60, label: '10 minutos' },
    { seconds: 60 * 60, label: '1 hora' },
    { seconds: 24 * 60 * 60, label: '1 día' },
    { seconds: 7 * 24 * 60 * 60, label: '1 semana' },
] as const;

// setTimeout keeps its delay in a signed 32-bit integer: anything above this (about 24.8 days) fires
// at once instead of waiting. A mute can last 28 days, so every timer that waits for one is armed in pieces.
export const MAX_TIMEOUT_MS = 2 ** 31 - 1;

const parseUntil = (mutedUntil: string | null | undefined): number | null => {
    if (!mutedUntil) return null;
    const until = Date.parse(mutedUntil);
    return Number.isNaN(until) ? null : until;
};

// Whether a mute is still on at `nowMs`. The dates are compared as instants, never as strings: the
// server's fraction digits vary, so two valid dates of the same moment may not sort alike. The exact
// instant is not muted, the same as chat's `now < mutedUntil`.
export const isMutedAt = (mutedUntil: string | null | undefined, nowMs: number): boolean => {
    const until = parseUntil(mutedUntil);
    return until !== null && nowMs < until;
};

// 24 hours on purpose: the default of es-AR depends on the ICU version ("18:30" or "06:30 p. m.").
const timeOf = (date: Date) =>
    date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// The hour when the mute ends today, the date and the hour when it ends on another day.
export const formatMutedUntil = (mutedUntil: string, nowMs: number = Date.now()): string => {
    const until = parseUntil(mutedUntil);
    if (until === null) return '';
    const date = new Date(until);
    if (date.toDateString() === new Date(nowMs).toDateString()) return timeOf(date);
    return `${date.toLocaleDateString('es-AR')} ${timeOf(date)}`;
};

export interface MuteStatus {
    muted: boolean;
    // The `mutedUntil` given while it is on, to show it; null otherwise.
    until: string | null;
}

// Tells whether a mute is still on and turns to `muted: false` by itself when it ends: nothing
// arrives from the server when a mute expires (SCRUM-71), so the client has to notice.
export const useMuteStatus = (mutedUntil: string | null | undefined): MuteStatus => {
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        // The clock the first render read may be old by the time a new date arrives.
        setNowMs(Date.now());
        const until = parseUntil(mutedUntil);
        if (until === null) return;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const arm = () => {
            const remaining = until - Date.now();
            if (remaining <= 0) {
                setNowMs(Date.now());
                return;
            }
            // Past the limit it waits for the most it can and arms again, until what is left fits.
            timer = setTimeout(arm, Math.min(remaining, MAX_TIMEOUT_MS));
        };
        arm();
        return () => clearTimeout(timer);
    }, [mutedUntil]);

    const muted = isMutedAt(mutedUntil, nowMs);
    return { muted, until: muted ? (mutedUntil ?? null) : null };
};
