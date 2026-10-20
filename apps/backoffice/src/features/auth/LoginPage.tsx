import { Navigate } from 'react-router-dom';
import { DiscordiaMark } from '@discordia/ui';
import { useAuth } from '@discordia/core';
import { LoginForm } from './LoginForm';
import { isStaff } from './isStaff';

export const LoginPage = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) return null;
    if (isStaff(user)) return <Navigate to="/" replace />;

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-discord-dark">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center gap-2 mb-8">
                    <DiscordiaMark />
                    <span className="text-xl font-black text-white font-display">Discordia</span>
                    <span className="text-xl font-light text-discord-muted font-display">Backoffice</span>
                </div>
                <div className="rounded-2xl p-8 shadow-2xl bg-discord-card">
                    <h1 className="mb-6 text-center text-2xl font-black text-white font-display">
                        Acceso del staff
                    </h1>
                    <LoginForm />
                </div>
            </div>
        </div>
    );
};
