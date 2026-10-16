import type { AdminUser } from '@discordia/api';
import { UserStatusBadge } from './UserStatusBadge';

interface UsersTableProps {
    users: AdminUser[];
    onSuspend: (user: AdminUser) => void;
}

// Staff cannot be suspended (E3) and a suspended account has nothing to suspend: both show "—".
// SCRUM-82 puts "Reactivar" in the suspended case.
const UserActions = ({ user, onSuspend }: { user: AdminUser; onSuspend: (user: AdminUser) => void }) => {
    if (user.role === 'staff' || user.status !== 'active') return <span>—</span>;

    return (
        <button
            type="button"
            aria-label={`Suspender a ${user.name}`}
            onClick={() => onSuspend(user)}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
        >
            Suspender
        </button>
    );
};

export const UsersTable = ({ users, onSuspend }: UsersTableProps) => (
    <div className="overflow-x-auto rounded-xl bg-discord-card">
        <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-discord-muted">
                <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Registro</th>
                    <th className="px-4 py-3">Acciones</th>
                </tr>
            </thead>
            <tbody className="text-white">
                {users.map((user) => (
                    <tr key={user.id} className="border-t border-white/5">
                        <td className="px-4 py-3">{user.name}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">{user.role}</td>
                        <td className="px-4 py-3">
                            <UserStatusBadge status={user.status} />
                        </td>
                        <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3">
                            <UserActions user={user} onSuspend={onSuspend} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
