import { Link } from 'react-router-dom';
import { useAuth } from '@discordia/core';

const cardClass = 'rounded-xl p-5 bg-discord-card';

export const HomePage = () => {
    const { user } = useAuth();

    return (
        <div>
            <h1 className="text-2xl font-black text-white font-display">Hola, {user?.name}</h1>
            <p className="mt-1 text-sm text-discord-muted">Las secciones del backoffice se van sumando acá.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Link to="/users" className={`${cardClass} block hover:bg-white/5`}>
                    <h2 className="font-bold text-white">Usuarios</h2>
                    <p className="mt-1 text-sm text-discord-muted">Buscar y filtrar usuarios de la plataforma.</p>
                </Link>
                <div className={cardClass}>
                    <h2 className="font-bold text-white">
                        Servidores <span className="text-xs font-normal text-discord-muted">· SCRUM-83</span>
                    </h2>
                    <p className="mt-1 text-sm text-discord-muted">Próximamente.</p>
                </div>
            </div>
        </div>
    );
};
