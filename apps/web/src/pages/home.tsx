import { useAuth } from '@discordia/context';
import { DiscordiaMark } from '@discordia/ui';
import { useNavigate } from 'react-router-dom';

export const Home = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/home');
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{ background: '#23272a' }}
        >
            <div
                className="w-full max-w-lg rounded-2xl p-8 shadow-2xl space-y-6"
                style={{ background: '#2c2f33' }}
            >
                <div className="flex items-center gap-3">
                    <DiscordiaMark />
                    <div>
                        <h1
                            className="text-2xl font-black text-white"
                            style={{ fontFamily: 'Nunito, sans-serif' }}
                        >
                            Discordia
                        </h1>
                        <p
                            className="text-xs text-[#99aab5]"
                            style={{ fontFamily: 'Open Sans, sans-serif' }}
                        >
                            Plataforma de comunicación y comunidades
                        </p>
                    </div>
                </div>

                <div
                    className="p-5 rounded-xl space-y-3"
                    style={{ background: '#23272a' }}
                >
                    <div className="flex items-center justify-between">
                        <span
                            className="text-xs font-semibold uppercase tracking-wider text-[#99aab5]"
                            style={{ fontFamily: 'Open Sans, sans-serif' }}
                        >
                            Sesión Activa
                        </span>
                    </div>

                    <div>
                        <p className="text-xs text-[#99aab5]">Nombre de usuario</p>
                        <p className="text-base font-bold text-white">{user?.name || 'Usuario'}</p>
                    </div>

                    <div>
                        <p className="text-xs text-[#99aab5]">Correo electrónico</p>
                        <p className="text-sm font-medium text-gray-300">{user?.email || 'N/A'}</p>
                    </div>
                </div>

                <button
                    onClick={handleSignOut}
                    className="w-full py-3 rounded-lg text-sm font-bold text-white transition-all duration-200 cursor-pointer"
                    style={{
                        background: '#ed4245',
                        fontFamily: 'Open Sans, sans-serif',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#c93b3e';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ed4245';
                    }}
                >
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
};