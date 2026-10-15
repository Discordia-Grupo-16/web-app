import { useState } from 'react';
import { getApiErrorMessage } from '@discordia/api';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { Pagination } from '@/shared/ui/Pagination';
import { type StatusFilter, UserFilters } from './UserFilters';
import { PAGE_SIZE, useAdminUsers } from './useAdminUsers';
import { UsersTable } from './UsersTable';

const FORBIDDEN_MESSAGE = 'Tu cuenta ya no tiene permisos de staff. Volvé a iniciar sesión.';

const isForbidden = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 403;

export const UsersPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [status, setStatus] = useState<StatusFilter>('');
    const [page, setPage] = useState({ filterKey: '', offset: 0 });

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

        return <UsersTable users={users} />;
    };

    return (
        <div>
            <h1 className="text-2xl font-black text-white font-display">Usuarios</h1>

            <div className="mt-6">
                <UserFilters
                    search={searchInput}
                    status={status}
                    onSearchChange={setSearchInput}
                    onStatusChange={setStatus}
                />
            </div>

            <div className="mt-6">{renderResults()}</div>

            {meta && !isLoading && !error && (
                <Pagination
                    total={meta.total}
                    limit={PAGE_SIZE}
                    offset={offset}
                    onPageChange={(next) => setPage({ filterKey, offset: next })}
                />
            )}
        </div>
    );
};
