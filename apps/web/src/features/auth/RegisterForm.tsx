import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DiscordiaMark } from "@discordia/ui";
import { useAuth, validateRegisterInput } from "@discordia/core";
import { getApiErrorMessage } from "@discordia/api";
import { authService } from '@/shared/api';

export const RegisterForm = ({ onSwitch }: { onSwitch: () => void }) => {
    const [form, setForm] = useState({ email: '', name: '', password: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { signIn } = useAuth()
    const navigate = useNavigate()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)

        const validation = validateRegisterInput(form)
        if (!validation.isValid) {
            setError(validation.error)
            return
        }

        setLoading(true)

        try {
            const { token, user } = await authService.register({
                email: form.email.trim(),
                name: form.name.trim(),
                password: form.password,
            })
            await signIn(token, user)
            navigate('/')
        } catch (err: unknown) {
            setError(getApiErrorMessage(err, 'Ocurrió un error al crear la cuenta. Intente nuevamente.'))
        } finally {
            setLoading(false)
        }
    }

    const inputStyle = {
        background: '#23272a',
        color: '#ffffff',
        border: '1.5px solid transparent',
        fontFamily: 'Open Sans, sans-serif',
    }

    const focusHandler = (e: React.FocusEvent<HTMLInputElement>) => {
        e.currentTarget.style.borderColor = '#7289da'
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(114,137,218,0.15)'
    }
    const blurHandler = (e: React.FocusEvent<HTMLInputElement>) => {
        e.currentTarget.style.borderColor = 'transparent'
        e.currentTarget.style.boxShadow = 'none'
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
                <DiscordiaMark width={32} height={32} />
                <span
                    className="text-xl font-black"
                    style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                >
                    Discordia
                </span>
            </div>

            <div className="rounded-2xl p-8 shadow-2xl" style={{ background: '#2c2f33' }}>
                <div className="mb-8 text-center">
                    <h2
                        className="text-2xl font-black mb-1"
                        style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                    >
                        Crea una cuenta
                    </h2>
                    <p className="text-sm" style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}>
                        Únete a millones de personas hoy.
                    </p>
                </div>

                {error && (
                    <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                    {[
                        { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'tu@correo.com' },
                        { key: 'name', label: 'Nombre completo o apodo', type: 'text', placeholder: 'ej. Jane Doe' },
                        { key: 'password', label: 'Contraseña', type: 'password', placeholder: '••••••••' },
                    ].map(({ key, label, type, placeholder }) => (
                        <div key={key}>
                            <label
                                className="block text-xs font-semibold uppercase tracking-wider mb-2"
                                style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
                            >
                                {label}
                            </label>
                            <input
                                type={type}
                                value={form[key as keyof typeof form]}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                required
                                placeholder={placeholder}
                                className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200 placeholder-[#99aab5]"
                                style={inputStyle}
                                onFocus={focusHandler}
                                onBlur={blurHandler}
                            />
                            {key === 'password' && (
                                <p className="text-[11px] mt-1.5" style={{ color: '#99aab5', fontFamily: 'Open Sans, sans-serif' }}>
                                    Mínimo 8 caracteres, con mayúscula, minúscula y número.
                                </p>
                            )}
                        </div>
                    ))}

                    <p className="text-xs leading-relaxed" style={{ color: '#99aab5', fontFamily: 'Open Sans, sans-serif' }}>
                        Al registrarte aceptas nuestros{' '}
                        <span className="underline cursor-pointer" style={{ color: '#7289da' }}>Términos de servicio</span>{' '}
                        y{' '}
                        <span className="underline cursor-pointer" style={{ color: '#7289da' }}>Política de privacidad</span>.
                    </p>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg text-sm font-bold transition-all duration-200"
                        style={{
                            background: loading ? '#5b6eae' : '#7289da',
                            color: '#ffffff',
                            fontFamily: 'Open Sans, sans-serif',
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#677bc4' }}
                        onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#7289da' }}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creando cuenta…
                            </span>
                        ) : (
                            'Registrarse'
                        )}
                    </button>
                </form>

                <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px" style={{ background: 'rgba(153,170,181,0.2)' }} />
                    <span className="text-xs" style={{ color: '#99aab5', fontFamily: 'Open Sans, sans-serif' }}>o</span>
                    <div className="flex-1 h-px" style={{ background: 'rgba(153,170,181,0.2)' }} />
                </div>

                <p
                    className="text-center text-sm"
                    style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
                >
                    ¿Ya tienes una cuenta?{' '}
                    <button
                        onClick={onSwitch}
                        className="font-semibold transition-colors hover:underline"
                        style={{ color: '#7289da' }}
                    >
                        Inicia sesión
                    </button>
                </p>
            </div>
        </div>
    )
}