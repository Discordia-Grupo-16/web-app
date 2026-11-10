import type { AdminServer } from '@discordia/api';

interface ServersTableProps {
    servers: AdminServer[];
    onDelete: (server: AdminServer) => void;
}

export const ServersTable = ({ servers, onDelete }: ServersTableProps) => (
    <div className="overflow-x-auto rounded-xl bg-discord-card">
        <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-discord-muted">
                <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Miembros</th>
                    <th className="px-4 py-3">Creado</th>
                </tr>
            </thead>
            <tbody className="text-white">
                {servers.map((server) => (
                    <tr key={server.id} className="border-t border-white/5">
                        <td className="px-4 py-3 font-medium">{server.name}</td>
                        <td className="px-4 py-3">{server.memberCount}</td>
                        <td className="px-4 py-3">{new Date(server.createdAt).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3 text-right">
                            <button
                                onClick={() => onDelete(server)}
                                className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                            >
                                Eliminar
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);