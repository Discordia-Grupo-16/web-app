import { useState } from 'react'
import { LoginForm } from '../components/loginForm'
import { RegisterForm } from '../components/registerForm'
import { WelcomePanel } from '../components/welcomePanel'

export const LoginRegister = () => {
    const [isLogin, setIsLogin] = useState(true)

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
                    <LoginForm onSwitch={() => setIsLogin(false)} />
                ) : (
                    <RegisterForm onSwitch={() => setIsLogin(true)} />
                )}
            </div>
        </div>
    )
}
