import { useEffect, useState } from 'react';
import type { ManualPresence, PresenceStatus } from '@discordia/api';

interface ManualPresenceOptions {
    /** What this client last saved. `chat` has no endpoint to read it back. */
    initial: ManualPresence;
    /** The own status as `chat` publishes it, or null while it is not known. */
    observed: PresenceStatus | null;
    /** `setManual` of the presence service. */
    save: (manual: ManualPresence) => Promise<void>;
    /** Called when the choice changes, so the app can remember it. */
    remember: (manual: ManualPresence) => void;
}

export interface ManualPresenceState {
    manual: ManualPresence;
    /** How the user is seen: what the own avatar shows. */
    status: PresenceStatus;
    saving: boolean;
    failed: boolean;
    choose: (manual: ManualPresence) => Promise<void>;
}

/**
 * The status the user sets by hand (SCRUM-27, CA3).
 *
 * `observed` corrects what is remembered when it changes, for example after choosing on another
 * device: `dnd` can only be manual, and `online` or `idle` mean there is no manual status. `offline`
 * corrects nothing, because it can be invisible or just a heartbeat that has not arrived yet.
 */
export const useManualPresence = ({ initial, observed, save, remember }: ManualPresenceOptions): ManualPresenceState => {
    const [manual, setManual] = useState<ManualPresence>(initial);
    const [seen, setSeen] = useState<PresenceStatus | null>(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    // Adjusted while rendering, and only when it changes: right after choosing, the old status is
    // still the observed one and must not undo the choice.
    if (observed !== seen) {
        setSeen(observed);
        if (observed === 'dnd') setManual('dnd');
        if (observed === 'online' || observed === 'idle') setManual(null);
    }

    // Remembered from an effect, so rendering stays free of side effects.
    useEffect(() => {
        remember(manual);
    }, [manual, remember]);

    const choose = async (next: ManualPresence) => {
        setSaving(true);
        setFailed(false);
        try {
            await save(next);
            setManual(next);
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    const status: PresenceStatus =
        manual === 'dnd' ? 'dnd' : manual === 'invisible' ? 'offline' : observed === 'idle' ? 'idle' : 'online';

    return { manual, status, saving, failed, choose };
};
