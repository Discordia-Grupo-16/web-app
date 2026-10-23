import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { DiscordiaMark } from '@discordia/ui';
import { useAuth } from '@discordia/core';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 text-sm font-semibold ${
        isActive ? 'bg-blurple text-white' : 'text-discord-muted hover:text-white'
    }`;

export const StaffLayout = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex bg-discord-dark">
            <aside className="w-56 shrink-0 p-4 bg-discord-card">
                <div className="flex items-center gap-2 mb-8">
                    <DiscordiaMark />
                    <span className="font-black text-white font-display">Backoffice</span>
                </div>
                <nav className="space-y-1">
                    <NavLink to="/" end className={navLinkClass}>
                        Inicio
                    </NavLink>
                    <span
                        aria-disabled="true"
                        title="Disponible con SCRUM-85"
                        className="block rounded-lg px-3 py-2 text-sm font-semibold text-discord-muted/40 cursor-not-allowed"
                    >
                        Usuarios
                    </span>
                </nav>
            </aside>

            <div className="flex-1 flex flex-col">
                <header className="flex items-center justify-end gap-4 px-6 py-3 border-b border-white/5">
                    <div className="text-right">
                        <p className="text-sm font-semibold text-white">{user?.name}</p>
                        <p className="text-xs text-discord-muted">{user?.email}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-white bg-blurple hover:bg-blurple-dark"
                    >
                        Cerrar sesión
                    </button>
                </header>
                <main className="flex-1 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
