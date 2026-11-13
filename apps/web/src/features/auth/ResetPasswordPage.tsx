import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DiscordiaMark } from '@discordia/ui'
import { validatePasswordRequired, validatePasswordStrength } from '@discordia/core'
import { getApiErrorMessage } from '@discordia/api'
import { authService } from '@/shared/api'
import { setLoginNotice } from '@/shared/session/loginNotice'
import { blurHandler, focusHandler, httpStatus, inputStyle, labelStyle } from './authFormStyles'

const INVALID_LINK_MESSAGE = 'El enlace no es válido o ya venció.'
const UPDATED_MESSAGE = 'Actualizamos tu contraseña. Iniciá sesión.'

type Status = 'checking' | 'invalid' | 'ready' | 'unavailable'

// The link carries the token in the fragment so it never reaches a server log. Read it once and
// remove it from the address bar, so it does not stay in the history or get copied by accident.
const takeTokenFromUrl = (): string | null => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    return token
}

export const ResetPasswordPage = () => {
    const navigate = useNavigate()
    // Kept in a ref: React runs effects twice in development and the fragment is already gone by the second run.
    const tokenRef = useRef<string | null | undefined>(undefined)
    const [status, setStatus] = useState<Status>('checking')
    const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null)
    const [password, setPassword] = useState('')
    const [confirmation, setConfirmation] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (tokenRef.current === undefined) tokenRef.current = takeTokenFromUrl()
        const token = tokenRef.current
        if (!token) {
            setStatus('invalid')
            return
        }

        let cancelled = false
        authService
            .checkPasswordReset(token)
            .then(() => {
                if (!cancelled) setStatus('ready')
            })
            .catch((err: unknown) => {
                if (cancelled) return
                if (httpStatus(err) === 400) {
                    setStatus('invalid')
                    return
                }
                setUnavailableMessage(getApiErrorMessage(err, 'No pudimos verificar el enlace. Intentá de nuevo.'))
                setStatus('unavailable')
            })
        return () => {
            cancelled = true
        }
    }, [])

    const goToRequest = () => navigate('/home', { replace: true, state: { forgotPassword: true } })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const required = validatePasswordRequired(password, 'Por favor ingresa una contraseña.')
        if (!required.isValid) return setError(required.error)
        const strength = validatePasswordStrength(password)
        if (!strength.isValid) return setError(strength.error)
        if (password !== confirmation) return setError('Las contraseñas no coinciden.')

        setLoading(true)
        try {
            await authService.confirmPasswordReset(tokenRef.current ?? '', password)
            setLoginNotice(UPDATED_MESSAGE, 'success')
            navigate('/home', { replace: true })
        } catch (err: unknown) {
            if (httpStatus(err) === 400) {
                setStatus('invalid')
            } else {
                setError(getApiErrorMessage(err, 'No pudimos cambiar la contraseña. Intentá de nuevo.'))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#23272a' }}>
            <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-8 justify-center">
                    <DiscordiaMark />
                    <span className="text-xl font-black" style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}>
                        Discordia
                    </span>
                </div>

                <div className="rounded-2xl p-8 shadow-2xl" style={{ background: '#2c2f33' }}>
                    <h2
                        className="text-2xl font-black mb-6 text-center"
                        style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                    >
                        Elegí una contraseña nueva
                    </h2>

                    {status === 'checking' && (
                        <p role="status" className="text-center text-sm" style={labelStyle}>
                            Verificando el enlace…
                        </p>
                    )}

                    {status === 'invalid' && (
                        <div className="space-y-5 text-center">
                            <div
                                role="alert"
                                className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium"
                            >
                                {INVALID_LINK_MESSAGE}
                            </div>
                            <button
                                type="button"
                                onClick={goToRequest}
                                className="w-full py-3 rounded-lg text-sm font-bold"
                                style={{ background: '#7289da', color: '#ffffff', fontFamily: 'Open Sans, sans-serif' }}
                            >
                                Pedir uno nuevo
                            </button>
                        </div>
                    )}

                    {status === 'unavailable' && (
                        <div
                            role="alert"
                            className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium"
                        >
                            {unavailableMessage}
                        </div>
                    )}

                    {status === 'ready' && (
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
                                        htmlFor="reset-password"
                                        className="block text-xs font-semibold uppercase tracking-wider mb-2"
                                        style={labelStyle}
                                    >
                                        Contraseña nueva
                                    </label>
                                    <input
                                        id="reset-password"
                                        type="password"
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 rounded-lg text-sm outline-none transition-all duration-200 placeholder-[#99aab5]"
                                        style={inputStyle}
                                        onFocus={focusHandler}
                                        onBlur={blurHandler}
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="reset-password-confirmation"
                                        className="block text-xs font-semibold uppercase tracking-wider mb-2"
                                        style={labelStyle}
                                    >
                                        Repetí la contraseña
                                    </label>
                                    <input
                                        id="reset-password-confirmation"
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirmation}
                                        onChange={(e) => setConfirmation(e.target.value)}
                                        placeholder="••••••••"
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
                                    {loading ? 'Guardando…' : 'Cambiar contraseña'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
