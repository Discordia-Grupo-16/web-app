import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeOffIcon } from '@discordia/ui';
import { useAuth, validateLoginInput } from '@discordia/core';
import { authService } from '@/shared/api';
import { isStaff } from './isStaff';
import { loginErrorMessage } from './loginErrorMessage';

const NOT_STAFF_MESSAGE = 'Esta cuenta no tiene acceso al backoffice.';

const inputClass =
    'w-full px-4 py-3 rounded-lg text-sm text-white bg-discord-dark outline-none border-[1.5px] border-transparent placeholder-discord-muted focus:border-blurple';

export const LoginForm = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { signIn } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const validation = validateLoginInput({ email, password });
        if (!validation.isValid) {
            setError(validation.error);
            return;
        }

        setLoading(true);
        try {
            const { token, user, refreshToken } = await authService.login({
                email: email.trim(),
                password,
            });
            // Without signIn nothing is stored: a non-staff account never gets a backoffice session.
            if (!isStaff(user)) {
                setError(NOT_STAFF_MESSAGE);
                return;
            }
            await signIn(token, user, refreshToken);
            navigate('/', { replace: true });
        } catch (err: unknown) {
            setError(loginErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {error && (
                <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium"
                >
                    {error}
                </div>
            )}

            <div>
                <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wider mb-2 text-discord-muted"
                >
                    Correo electrónico
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    placeholder="staff@discordia.dev"
                    className={inputClass}
                />
            </div>

            <div>
                <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider mb-2 text-discord-muted"
                >
                    Contraseña
                </label>
                <div className="relative">
                    <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className={`${inputClass} pr-12`}
                    />
                    <button
                        type="button"
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-discord-muted"
                    >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-bold text-white bg-blurple hover:bg-blurple-dark disabled:bg-blurple-dark disabled:cursor-not-allowed"
            >
                {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
            </button>
        </form>
    );
};
