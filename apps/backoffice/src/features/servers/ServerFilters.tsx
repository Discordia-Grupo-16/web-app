interface ServerFiltersProps {
    search: string;
    onSearchChange: (value: string) => void;
}

const fieldClass =
    'px-4 py-2 rounded-lg text-sm text-white bg-discord-card outline-none border-[1.5px] border-transparent placeholder-discord-muted focus:border-blurple';

export const ServerFilters = ({ search, onSearchChange }: ServerFiltersProps) => (
    <div className="flex flex-wrap gap-3">
        <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre de servidor"
            aria-label="Buscar por nombre de servidor"
            maxLength={100}
            className={`${fieldClass} w-72`}
        />
    </div>
);
