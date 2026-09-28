import { useState } from "react";
import { DiscordiaMark } from "@discordia/ui";
import { EyeIcon, EyeOffIcon } from "./ui/eyeIcons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@discordia/context";
import { validateLoginInput, getApiErrorMessage } from "@discordia/services";
import { authService } from "../services/authService.ts";

export const LoginForm = ({ onSwitch }: { onSwitch: () => void }) => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const validation = validateLoginInput({ email, password })
        if (!validation.isValid) {
            setError(validation.error)
            return
        }

        setLoading(true)

        try {
            const { token, user, refreshToken } = await authService.login({
                email: email.trim(),
                password,
            })
            await signIn(token, user, refreshToken)
            navigate('/')
        } catch (err: unknown) {
            setError(getApiErrorMessage(err, 'Credenciales inválidas o error al iniciar sesión.'))
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
                <DiscordiaMark />
                <span
                    className="text-xl font-black"
                    style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                >
                    Discordia
                </span>
            </div>

            <div
                className="rounded-2xl p-8 shadow-2xl"
                style={{ background: '#2c2f33' }}
            >
                <div className="mb-8 text-center">
                    <h2
                        className="text-2xl font-black mb-1"
                        style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                    >
                        ¡Bienvenido de vuelta!
                    </h2>
                    <p className="text-sm" style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}>
                        Nos alegra verte de nuevo.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    <div>
                        <label
                            className="block text-xs font-semibold uppercase tracking-wider mb-2"
                            style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
                        >
                            Correo electrónico o teléfono
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="tu@correo.com"
                            className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200 placeholder-[#99aab5]"
                            style={{
                                background: '#23272a',
                                color: '#ffffff',
                                border: '1.5px solid transparent',
                                fontFamily: 'Open Sans, sans-serif',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#7289da'
                                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(114,137,218,0.15)'
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'transparent'
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        />
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label
                                className="block text-xs font-semibold uppercase tracking-wider"
                                style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
                            >
                                Contraseña
                            </label>
                            <button
                                type="button"
                                className="text-xs font-medium transition-colors hover:underline"
                                style={{ fontFamily: 'Open Sans, sans-serif', color: '#7289da' }}
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="w-full px-4 py-3 pr-12 rounded-lg text-sm outline-none transition-all duration-200 placeholder-[#99aab5]"
                                style={{
                                    background: '#23272a',
                                    color: '#ffffff',
                                    border: '1.5px solid transparent',
                                    fontFamily: 'Open Sans, sans-serif',
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = '#7289da'
                                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(114,137,218,0.15)'
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = 'transparent'
                                    e.currentTarget.style.boxShadow = 'none'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                style={{ color: '#99aab5' }}
                            >
                                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg text-sm font-bold transition-all duration-200 relative overflow-hidden"
                        style={{
                            background: loading ? '#5b6eae' : '#7289da',
                            color: '#ffffff',
                            fontFamily: 'Open Sans, sans-serif',
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            if (!loading) e.currentTarget.style.background = '#677bc4'
                        }}
                        onMouseLeave={(e) => {
                            if (!loading) e.currentTarget.style.background = '#7289da'
                        }}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Iniciando sesión…
                            </span>
                        ) : (
                            'Iniciar sesión'
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px" style={{ background: 'rgba(153,170,181,0.2)' }} />
                    <span className="text-xs" style={{ color: '#99aab5', fontFamily: 'Open Sans, sans-serif' }}>
                        o
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(153,170,181,0.2)' }} />
                </div>

                {/* Register prompt */}
                <p
                    className="text-center text-sm"
                    style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
                >
                    ¿No tienes una cuenta?{' '}
                    <button
                        onClick={onSwitch}
                        className="font-semibold transition-colors hover:underline"
                        style={{ color: '#7289da' }}
                    >
                        Regístrate
                    </button>
                </p>
            </div>
        </div>
    )
}