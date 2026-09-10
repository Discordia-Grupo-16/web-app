import { useState } from "react";

function DiscordMark() {
    return (
        <svg width="32" height="32" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.401329 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.292408 45.3914C0.299005 45.4625 0.339305 45.5308 0.395609 45.5729C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5899C16.1893 45.5083 16.1781 45.3082 16.3068 45.2124C16.679 44.9347 17.0513 44.6459 17.4067 44.3543C17.471 44.3009 17.5606 44.2896 17.6362 44.3233C29.2917 49.6205 41.8503 49.6205 53.3629 44.3233C53.4385 44.2868 53.5282 44.2981 53.5953 44.3515C53.9507 44.6431 54.323 44.9347 54.6980 45.2124C54.8268 45.3082 54.8184 45.5083 54.6757 45.5899C52.907 46.6197 51.0683 47.4931 49.1345 48.2228C49.0086 48.2707 48.9526 48.4172 49.0142 48.5383C50.0808 50.6035 51.2982 52.5699 52.6388 54.435C52.6948 54.5139 52.7955 54.5477 52.8879 54.5195C58.6865 52.7249 64.5691 50.0174 70.6322 45.5729C70.6913 45.5308 70.7288 45.4653 70.7354 45.3942C72.2183 30.0791 68.2277 16.7757 60.1968 4.9823C60.1774 4.9429 60.1437 4.9147 60.1045 4.8978Z"
                fill="#7289da"
            />
        </svg>
    )
}



export const RegisterForm = ({ onSwitch }: { onSwitch: () => void }) => {
    const [form, setForm] = useState({ email: '', username: '', password: '' })
    const [loading, setLoading] = useState(false)

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setTimeout(() => setLoading(false), 1800)
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
                <DiscordMark />
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

                <form onSubmit={handleSubmit} className="space-y-5">
                    {[
                        { key: 'email', label: 'Correo electrónico', type: 'email', placeholder: 'tu@correo.com' },
                        { key: 'username', label: 'Nombre de usuario', type: 'text', placeholder: 'ej. dragon_xyz' },
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