import { useState } from 'react';
import { getApiErrorMessage, type AdminUser } from '@discordia/api';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Pagination } from '@/shared/ui/Pagination';
import { type StatusFilter, UserFilters } from './UserFilters';
import { PAGE_SIZE, useAdminUsers } from './useAdminUsers';
import { type UserStatusAction, useUserStatusAction } from './useUserStatusAction';
import { UsersTable } from './UsersTable';

const FORBIDDEN_MESSAGE = 'Tu cuenta ya no tiene permisos de staff. Volvé a iniciar sesión.';

const FEEDBACK: Record<UserStatusAction, string> = {
    suspend: 'Cuenta suspendida.',
    reactivate: 'Cuenta reactivada.',
};

const dialogCopy = (user: AdminUser, kind: UserStatusAction) => {
    switch (kind) {
        case 'suspend':
            return {
                title: `¿Suspender a ${user.name}?`,
                description: `${user.email} no va a poder iniciar sesión, se cierran todas sus sesiones abiertas y su perfil deja de estar visible. Podés reactivarla después.`,
                confirmLabel: 'Suspender cuenta',
                tone: 'danger' as const,
            };
        case 'reactivate':
            return {
                title: `¿Reactivar a ${user.name}?`,
                description: 'Va a poder volver a iniciar sesión y su perfil vuelve a estar visible.',
                confirmLabel: 'Reactivar cuenta',
                tone: 'default' as const,
            };
    }
};

const isForbidden = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 403;

export const UsersPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [status, setStatus] = useState<StatusFilter>('');
    const [page, setPage] = useState({ filterKey: '', offset: 0 });

    // Outcome of the last action, shown above the table: success as a status, a stale list as an alert.
    // It is about a row, so the handlers that change what is listed clear it. Not an effect on the
    // list: the reload that follows the action itself would erase it as soon as it appears.
    const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

    const search = useDebouncedValue(searchInput.trim(), 300);

    // The offset belongs to the filters it was chosen under: when they change it is 0 again. Derived
    // here (no effect) so no request goes out with the new filters and the old page.
    const filterKey = JSON.stringify([search, status]);
    const offset = page.filterKey === filterKey ? page.offset : 0;

    const { users, meta, isLoading, error, reload } = useAdminUsers({
        search,
        status: status || undefined,
        offset,
    });

    const action = useUserStatusAction({
        onDone: (_updated, kind) => {
            reload();
            setFeedback({ tone: 'success', message: FEEDBACK[kind] });
        },
        onConflict: (message) => {
            reload();
            setFeedback({ tone: 'error', message });
        },
    });
    const copy = action.target && action.kind ? dialogCopy(action.target, action.kind) : null;

    const openAction = (target: AdminUser, kind: UserStatusAction) => {
        setFeedback(null);
        action.open(target, kind);
    };

    const hasFilters = search !== '' || status !== '';

    const renderResults = () => {
        if (isLoading) return <p className="text-sm text-discord-muted">Cargando usuarios…</p>;

        if (error) {
            return (
                <div role="alert" className="space-y-3">
                    <p className="text-sm text-red-400">
                        {isForbidden(error)
                            ? FORBIDDEN_MESSAGE
                            : getApiErrorMessage(error, 'No se pudieron cargar los usuarios.')}
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

        if (users.length === 0) {
            return (
                <p className="text-sm text-discord-muted">
                    {hasFilters
                        ? 'Ningún usuario coincide con la búsqueda.'
                        : 'Todavía no hay usuarios registrados.'}
                </p>
            );
        }

        return (
            <UsersTable
                users={users}
                onSuspend={(target) => openAction(target, 'suspend')}
                onReactivate={(target) => openAction(target, 'reactivate')}
            />
        );
    };

    return (
        <div>
            <h1 className="text-2xl font-black text-white font-display">Usuarios</h1>

            <div className="mt-6">
                <UserFilters
                    search={searchInput}
                    status={status}
                    onSearchChange={(value) => {
                        setFeedback(null);
                        setSearchInput(value);
                    }}
                    onStatusChange={(value) => {
                        setFeedback(null);
                        setStatus(value);
                    }}
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
                        setFeedback(null);
                        setPage({ filterKey, offset: next });
                    }}
                />
            )}

            <ConfirmDialog
                open={copy !== null}
                title={copy?.title ?? ''}
                description={copy?.description ?? ''}
                confirmLabel={copy?.confirmLabel ?? ''}
                tone={copy?.tone ?? 'default'}
                isSubmitting={action.isSubmitting}
                error={action.error}
                onConfirm={action.confirm}
                onCancel={action.cancel}
            />
        </div>
    );
};
