import { PRESENCE_LABELS } from '@discordia/core';
import type { PresenceStatus } from '@discordia/api';

const COLORS: Record<PresenceStatus, string> = {
    online: '#3ba55d',
    idle: '#faa61a',
    dnd: '#ed4245',
    offline: '#747f8d',
};

interface PresenceDotProps {
    status: PresenceStatus;
    /** Color of the ring that separates the dot from the avatar: the one of the panel behind. */
    ring: string;
    /** `lg` for the big avatar of a profile. */
    size?: 'sm' | 'lg';
}

// Drawn on the bottom right corner of a `relative` avatar. The label is what tells the status apart
// without relying on the color.
export const PresenceDot = ({ status, ring, size = 'sm' }: PresenceDotProps) => (
    <span
        role="img"
        aria-label={PRESENCE_LABELS[status]}
        title={PRESENCE_LABELS[status]}
        className={`absolute -bottom-0.5 -right-0.5 rounded-full ${size === 'lg' ? 'w-4 h-4' : 'w-2.5 h-2.5'}`}
        style={{ background: COLORS[status], boxShadow: `0 0 0 2px ${ring}` }}
    />
);
