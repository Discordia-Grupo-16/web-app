import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { consumeLoginNotice } from '@/shared/session/loginNotice'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { WelcomePanel } from './WelcomePanel'

export const LoginRegisterPage = () => {
    const location = useLocation()
    const [isLogin, setIsLogin] = useState(true)
    // "Pedir uno nuevo" in /reset-password lands here already on the request form.
    const [isForgot, setIsForgot] = useState(
        (location.state as { forgotPassword?: boolean } | null)?.forgotPassword === true,
    )
    // Lazy initializer: consumed once on mount, so re-renders keep it and a later visit does not.
    const [notice, setNotice] = useState(consumeLoginNotice)

    return (
        <div
            className="size-full min-h-screen grid lg:grid-cols-[1fr_480px]"
            style={{ background: '#23272a' }}
        >
            <WelcomePanel />
            <div
                className="flex items-center justify-center p-6 lg:p-10 min-h-screen lg:min-h-0"
                style={{ background: '#23272a' }}
            >
                {isForgot ? (
                    <ForgotPasswordForm onBack={() => setIsForgot(false)} />
                ) : isLogin ? (
                    <LoginForm
                        onSwitch={() => setIsLogin(false)}
                        onForgotPassword={() => setIsForgot(true)}
                        notice={notice}
                        onSubmitAttempt={() => setNotice(null)}
                    />
                ) : (
                    <RegisterForm onSwitch={() => setIsLogin(true)} />
                )}
            </div>
        </div>
    )
}
