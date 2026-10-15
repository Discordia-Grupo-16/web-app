import type { AdminUserStatus } from '@discordia/api';

const BADGES: Record<AdminUserStatus, { label: string; className: string }> = {
    active: { label: 'Activo', className: 'bg-green-500/10 text-green-400 border-green-500/30' },
    suspended: { label: 'Suspendido', className: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

// The text is always visible: the color alone would not be enough for color-blind users.
export const UserStatusBadge = ({ status }: { status: AdminUserStatus }) => {
    const { label, className } = BADGES[status];

    return (
        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
            {label}
        </span>
    );
};
