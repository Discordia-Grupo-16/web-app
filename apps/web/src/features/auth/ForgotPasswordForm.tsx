import { useState } from 'react'
import { DiscordiaMark } from '@discordia/ui'
import { validateEmail } from '@discordia/core'
import { getApiErrorMessage } from '@discordia/api'
import { authService } from '@/shared/api'
import { blurHandler, focusHandler, httpStatus, inputStyle, labelStyle } from './authFormStyles'

const SENT_MESSAGE = 'Si el correo está registrado, te llega un link para cambiar la contraseña.'
const TOO_MANY_MESSAGE = 'Hiciste muchos pedidos. Probá de nuevo en unos minutos.'

export const ForgotPasswordForm = ({ onBack }: { onBack: () => void }) => {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const validation = validateEmail(email)
        if (!validation.isValid) {
            setError(validation.error)
            return
        }

        setLoading(true)
        try {
            await authService.requestPasswordReset(email.trim())
            setSent(true)
        } catch (err: unknown) {
            setError(
                httpStatus(err) === 429
                    ? TOO_MANY_MESSAGE
                    : getApiErrorMessage(err, 'No pudimos enviar el pedido. Intentá de nuevo.'),
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="flex lg:hidden items-center gap-2 mb-8 justify-center">
                <DiscordiaMark />
                <span className="text-xl font-black" style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}>
                    Discordia
                </span>
            </div>

            <div className="rounded-2xl p-8 shadow-2xl" style={{ background: '#2c2f33' }}>
                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-black mb-1" style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}>
                        Recuperá tu contraseña
                    </h2>
                    <p className="text-sm" style={labelStyle}>
                        Te mandamos un link al correo para elegir una nueva.
                    </p>
                </div>

                {sent ? (
                    <div
                        role="status"
                        className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-medium"
                    >
                        {SENT_MESSAGE}
                    </div>
                ) : (
                    <>
                        {error && (
                            <div
                                role="alert"
                                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium"
                            >
                                {error}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} noValidate className="space-y-5">
                            <div>
                                <label
                                    htmlFor="forgot-email"
                                    className="block text-xs font-semibold uppercase tracking-wider mb-2"
                                    style={labelStyle}
                                >
                                    Correo electrónico
                                </label>
                                <input
                                    id="forgot-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@correo.com"
                                    className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200 placeholder-[#99aab5]"
                                    style={inputStyle}
                                    onFocus={focusHandler}
                                    onBlur={blurHandler}
                                />
                            </div>
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
                            >
                                {loading ? 'Enviando…' : 'Enviar link'}
                            </button>
                        </form>
                    </>
                )}

                <p className="text-center text-sm mt-5" style={labelStyle}>
                    <button
                        type="button"
                        onClick={onBack}
                        className="font-semibold transition-colors hover:underline"
                        style={{ color: '#7289da' }}
                    >
                        Volver a iniciar sesión
                    </button>
                </p>
            </div>
        </div>
    )
}
