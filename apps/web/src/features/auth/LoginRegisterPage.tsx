import { useState } from 'react'
import { consumeLoginNotice } from '@/shared/session/loginNotice'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { WelcomePanel } from './WelcomePanel'

export const LoginRegisterPage = () => {
    const [isLogin, setIsLogin] = useState(true)
    // Lazy initializer: consumed once on mount, so re-renders keep it and a later visit does not.
    const [notice] = useState(consumeLoginNotice)

    return (
        <div
            className="size-full min-h-screen grid lg:grid-cols-[1fr_480px]"
            style={{ background: '#23272a' }}
        >
            <WelcomePanel />
            <div
                className="flex flex-col items-center justify-center p-6 lg:p-10 min-h-screen lg:min-h-0"
                style={{ background: '#23272a' }}
            >
                {notice && (
                    <div
                        role="alert"
                        className="w-full max-w-md mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium"
                    >
                        {notice}
                    </div>
                )}
                {isLogin ? (
                    <LoginForm onSwitch={() => setIsLogin(false)} />
                ) : (
                    <RegisterForm onSwitch={() => setIsLogin(true)} />
                )}
            </div>
        </div>
    )
}
