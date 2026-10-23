interface PaginationProps {
    total: number;
    limit: number;
    offset: number;
    onPageChange: (offset: number) => void;
}

const buttonClass =
    'rounded-lg px-3 py-2 text-sm font-semibold text-white bg-blurple hover:bg-blurple-dark disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blurple';

export const Pagination = ({ total, limit, offset, onPageChange }: PaginationProps) => {
    if (total === 0) return null;

    const first = offset + 1;
    const last = Math.min(offset + limit, total);

    return (
        <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-discord-muted">
                Mostrando {first}–{last} de {total}
            </p>
            <div className="flex gap-2">
                <button
                    type="button"
                    disabled={offset === 0}
                    onClick={() => onPageChange(Math.max(0, offset - limit))}
                    className={buttonClass}
                >
                    Anterior
                </button>
                <button
                    type="button"
                    disabled={offset + limit >= total}
                    onClick={() => onPageChange(offset + limit)}
                    className={buttonClass}
                >
                    Siguiente
                </button>
            </div>
        </div>
    );
};
