import type { ManualPresence } from '@discordia/api';
import { PRESENCE_LABELS, type ManualPresenceState } from '@discordia/core';

const OPTIONS: { value: ManualPresence; label: string; hint?: string }[] = [
    { value: null, label: PRESENCE_LABELS.online },
    { value: 'dnd', label: PRESENCE_LABELS.dnd },
    { value: 'invisible', label: 'Invisible', hint: 'Aparecés como desconectado' },
];

// The status the user sets by hand (SCRUM-27, CA3). "En línea" goes back to the automatic one, so
// the user can still show as idle.
export const PresenceSelector = ({ presence }: { presence: ManualPresenceState }) => (
    <fieldset disabled={presence.saving}>
        <legend className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#72767d' }}>
            Estado
        </legend>
        {OPTIONS.map(({ value, label, hint }) => (
            <label key={label} className="flex items-start gap-2 py-1 text-sm cursor-pointer" style={{ color: '#dcddde' }}>
                <input
                    type="radio"
                    name="presence"
                    className="mt-1"
                    aria-label={label}
                    checked={presence.manual === value}
                    onChange={() => void presence.choose(value)}
                />
                <span>
                    {label}
                    {hint && <span className="block text-xs" style={{ color: '#99aab5' }}>{hint}</span>}
                </span>
            </label>
        ))}
        {presence.failed && (
            <p role="alert" className="text-xs mt-1" style={{ color: '#ed4245' }}>
                No pudimos cambiar tu estado. Probá de nuevo.
            </p>
        )}
    </fieldset>
);
