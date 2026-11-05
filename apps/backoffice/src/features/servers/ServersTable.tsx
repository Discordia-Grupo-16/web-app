import type { AdminServer } from '@discordia/api';

interface ServersTableProps {
    servers: AdminServer[];
}

export const ServersTable = ({ servers }: ServersTableProps) => (
    <div className="overflow-x-auto rounded-xl bg-discord-card">
        <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-discord-muted">
                <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Miembros</th>
                    <th className="px-4 py-3">Registro</th>
                </tr>
            </thead>
            <tbody className="text-white">
                {servers.map((server) => (
                    <tr key={server.id} className="border-t border-white/5">
                        <td className="px-4 py-3 font-medium">{server.name}</td>
                        <td className="px-4 py-3">{server.memberCount}</td>
                        <td className="px-4 py-3">{new Date(server.createdAt).toLocaleDateString('es-AR')}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);