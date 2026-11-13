import type { AdminServer } from '@discordia/api';

interface ServersTableProps {
    servers: AdminServer[];
    onDelete: (server: AdminServer) => void;
    onSuspend: (server: AdminServer) => void;
    onReactivate: (server: AdminServer) => void;
}

export const ServersTable = ({ servers, onDelete, onSuspend, onReactivate }: ServersTableProps) => (
    <div className="overflow-x-auto rounded-xl bg-discord-card">
        <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-discord-muted">
                <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Miembros</th>
                    <th className="px-4 py-3">Creado</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="text-white">
                {servers.map((server) => (
                    <tr key={server.id} className="border-t border-white/5">
                        <td className="px-4 py-3 font-medium">{server.name}</td>
                        <td className="px-4 py-3">{server.memberCount}</td>
                        <td className="px-4 py-3">{new Date(server.createdAt).toLocaleDateString('es-AR')}</td>
                        <td className="px-4 py-3">
                            <span className={server.is_suspended ? 'text-red-400' : 'text-green-400'}>
                                {server.is_suspended ? 'Suspendido' : 'Activo'}
                            </span>
                        </td>
                        <td className="space-x-2 px-4 py-3 text-right">
                            {server.is_suspended ? (
                                <button
                                    type="button"
                                    aria-label={`Reactivar ${server.name}`}
                                    onClick={() => onReactivate(server)}
                                    className="rounded-lg bg-blurple px-3 py-1.5 text-xs font-semibold text-white hover:bg-blurple-dark"
                                >
                                    Reactivar
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    aria-label={`Suspender ${server.name}`}
                                    onClick={() => onSuspend(server)}
                                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                                >
                                    Suspender
                                </button>
                            )}
                            <button
                                type="button"
                                aria-label={`Eliminar ${server.name}`}
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