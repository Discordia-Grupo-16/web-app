import type { AdminUserStatus } from '@discordia/api';

export type StatusFilter = AdminUserStatus | '';

interface UserFiltersProps {
    search: string;
    status: StatusFilter;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: StatusFilter) => void;
}

const fieldClass =
    'px-4 py-2 rounded-lg text-sm text-white bg-discord-card outline-none border-[1.5px] border-transparent placeholder-discord-muted focus:border-blurple';

export const UserFilters = ({ search, status, onSearchChange, onStatusChange }: UserFiltersProps) => (
    <div className="flex flex-wrap gap-3">
        <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por email o nombre"
            aria-label="Buscar por email o nombre"
            maxLength={100}
            className={`${fieldClass} w-72`}
        />
        <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            aria-label="Estado"
            className={fieldClass}
        >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
        </select>
    </div>
);
