import { useAuth } from '@discordia/core';

const UPCOMING_SECTIONS = [
    { title: 'Usuarios', ticket: 'SCRUM-85', description: 'Listado y búsqueda de usuarios.' },
    { title: 'Servidores', ticket: 'SCRUM-83', description: 'Próximamente.' },
];

export const HomePage = () => {
    const { user } = useAuth();

    return (
        <div>
            <h1 className="text-2xl font-black text-white font-display">Hola, {user?.name}</h1>
            <p className="mt-1 text-sm text-discord-muted">Las secciones del backoffice se van sumando acá.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {UPCOMING_SECTIONS.map(({ title, ticket, description }) => (
                    <div key={ticket} className="rounded-xl p-5 bg-discord-card">
                        <h2 className="font-bold text-white">
                            {title} <span className="text-xs font-normal text-discord-muted">· {ticket}</span>
                        </h2>
                        <p className="mt-1 text-sm text-discord-muted">{description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
