import type { AdminUser } from '@discordia/api';
import { UserStatusBadge } from './UserStatusBadge';

export const UsersTable = ({ users }: { users: AdminUser[] }) => (
    <div className="overflow-x-auto rounded-xl bg-discord-card">
        <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-discord-muted">
                <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Registro</th>
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
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);
