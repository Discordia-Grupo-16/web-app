import { useState } from 'react'
import { consumeLoginNotice } from '@/shared/session/loginNotice'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { WelcomePanel } from './WelcomePanel'

export const LoginRegisterPage = () => {
    const [isLogin, setIsLogin] = useState(true)
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
                {isLogin ? (
                    <LoginForm
                        onSwitch={() => setIsLogin(false)}
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
