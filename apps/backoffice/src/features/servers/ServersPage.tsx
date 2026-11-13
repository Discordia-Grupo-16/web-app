import { useState } from 'react';
import { getApiErrorMessage, type AdminServer } from '@discordia/api';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Pagination } from '@/shared/ui/Pagination';
import { ServerFilters } from './ServerFilters';
import { PAGE_SIZE, useAdminServers } from './useAdminServers';
import { ServersTable } from './ServersTable';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { adminServerService } from '@/shared/api';

const FORBIDDEN_MESSAGE = 'Tu cuenta ya no tiene permisos de staff. Volvé a iniciar sesión.';
type ServerStatusAction = 'suspend' | 'reactivate';

const isForbidden = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 403;
const isNotFound = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 404;

const statusActionCopy = (server: AdminServer, kind: ServerStatusAction) => kind === 'suspend'
    ? {
        title: `¿Suspender ${server.name}?`,
        description: 'Los miembros no podrán enviar mensajes ni usar los canales de voz de este servidor. Podés reactivarlo después.',
        confirmLabel: 'Suspender servidor',
        tone: 'danger' as const,
    }
    : {
        title: `¿Reactivar ${server.name}?`,
        description: 'Los miembros volverán a poder usar este servidor.',
        confirmLabel: 'Reactivar servidor',
        tone: 'default' as const,
    };

export const ServersPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [page, setPage] = useState({ filterKey: '', offset: 0 });

    const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
    const [serverToDelete, setServerToDelete] = useState<AdminServer | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [statusAction, setStatusAction] = useState<{ server: AdminServer; kind: ServerStatusAction } | null>(null);
    const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
    const [statusError, setStatusError] = useState<string | null>(null);

    const search = useDebouncedValue(searchInput.trim(), 300);

    const filterKey = search;
    const offset = page.filterKey === filterKey ? page.offset : 0;

    const { servers, meta, isLoading, error, reload } = useAdminServers({
        search,
        offset,
        onPastEnd: (previousOffset) => setPage({ filterKey, offset: previousOffset }),
    });

    const hasFilters = search !== '';

    const handleConfirmDelete = async () => {
        if (!serverToDelete) return;

        setIsDeleting(true);
        setDeleteError(null);

        try {
            await adminServerService.deleteServer(serverToDelete.id);

            setFeedback({ tone: 'success', message: 'Servidor eliminado correctamente.' });
        } catch (err) {
            if (isNotFound(err)) {
                setFeedback({ tone: 'success', message: 'Servidor eliminado correctamente.' });
            } else {
                setDeleteError(isForbidden(err)
                    ? FORBIDDEN_MESSAGE
                    : getApiErrorMessage(err, 'No se pudo eliminar el servidor.'));
                return;
            }
        } finally {
            setIsDeleting(false);
        }

        reload();
        setServerToDelete(null);
    };

    const handleConfirmStatusAction = async () => {
        if (!statusAction || isStatusSubmitting) return;

        setIsStatusSubmitting(true);
        setStatusError(null);
        try {
            if (statusAction.kind === 'suspend') {
                await adminServerService.suspendServer(statusAction.server.id);
            } else {
                await adminServerService.reactivateServer(statusAction.server.id);
            }
            setFeedback({
                tone: 'success',
                message: statusAction.kind === 'suspend' ? 'Servidor suspendido correctamente.' : 'Servidor reactivado correctamente.',
            });
            setStatusAction(null);
            reload();
        } catch (err) {
            setStatusError(getApiErrorMessage(
                err,
                statusAction.kind === 'suspend' ? 'No se pudo suspender el servidor.' : 'No se pudo reactivar el servidor.',
            ));
        } finally {
            setIsStatusSubmitting(false);
        }
    };

    const openStatusAction = (server: AdminServer, kind: ServerStatusAction) => {
        setFeedback(null);
        setStatusError(null);
        setStatusAction({ server, kind });
    };

    const statusCopy = statusAction ? statusActionCopy(statusAction.server, statusAction.kind) : null;

    const renderResults = () => {
        if (isLoading) return <p className="text-sm text-discord-muted">Cargando servidores…</p>;

        if (error) {
            return (
                <div role="alert" className="space-y-3">
                    <p className="text-sm text-red-400">
                        {isForbidden(error)
                            ? FORBIDDEN_MESSAGE
                            : getApiErrorMessage(error, 'No se pudieron cargar los servidores.')}
                    </p>
                    {!isForbidden(error) && (
                        <button
                            type="button"
                            onClick={reload}
                            className="rounded-lg px-3 py-2 text-sm font-semibold text-white bg-blurple hover:bg-blurple-dark"
                        >
                            Reintentar
                        </button>
                    )}
                </div>
            );
        }

        if (servers.length === 0) {
            return (
                <p className="text-sm text-discord-muted">
                    {hasFilters
                        ? 'Ningún servidor coincide con la búsqueda.'
                        : 'Todavía no hay servidores creados.'}
                </p>
            );
        }

        return (
            <ServersTable
                servers={servers}
                onDelete={(server) => {
                    setFeedback(null);
                    setServerToDelete(server);
                }}
                onSuspend={(server) => openStatusAction(server, 'suspend')}
                onReactivate={(server) => openStatusAction(server, 'reactivate')}
            />
        );
    };

    return (
        <div>
            <h1 className="text-2xl font-black text-white font-display">Servidores</h1>

            <div className="mt-6">
                <ServerFilters
                    search={searchInput}
                    onSearchChange={setSearchInput}
                />
            </div>

            {feedback && (
                <p
                    role={feedback.tone === 'success' ? 'status' : 'alert'}
                    className={`mt-6 text-sm font-semibold ${feedback.tone === 'success' ? 'text-green-400' : 'text-red-400'}`}
                >
                    {feedback.message}
                </p>
            )}

            <div className="mt-6">{renderResults()}</div>

            {meta && !isLoading && !error && (
                <Pagination
                    total={meta.total}
                    limit={PAGE_SIZE}
                    offset={offset}
                    onPageChange={(next) => {
                        setPage({ filterKey, offset: next });
                    }}
                />
            )}

            <ConfirmDialog
                open={serverToDelete !== null}
                title={`¿Eliminar servidor ${serverToDelete?.name}?`}
                description="Esta acción es irreversible. Se borrarán todos los canales y configuraciones de este servidor."
                confirmationText={serverToDelete?.name}
                confirmLabel="Eliminar servidor"
                tone="danger"
                isSubmitting={isDeleting}
                error={deleteError}
                onConfirm={handleConfirmDelete}
                onCancel={() => {
                    setServerToDelete(null);
                    setDeleteError(null);
                }}
            />
            <ConfirmDialog
                open={statusCopy !== null}
                title={statusCopy?.title ?? ''}
                description={statusCopy?.description ?? ''}
                confirmLabel={statusCopy?.confirmLabel ?? ''}
                tone={statusCopy?.tone ?? 'default'}
                isSubmitting={isStatusSubmitting}
                error={statusError}
                onConfirm={handleConfirmStatusAction}
                onCancel={() => {
                    setStatusAction(null);
                    setStatusError(null);
                }}
            />
        </div>
    );
};