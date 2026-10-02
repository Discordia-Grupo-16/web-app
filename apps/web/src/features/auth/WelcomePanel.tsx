import { DiscordiaMark } from "@discordia/ui";
import { ChatBubble } from './ChatBubble';
import { Stat } from './Stat'

export const WelcomePanel = () => {
    return (
        <div
            className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #23272a 0%, #2c2f33 60%, #1e2124 100%)' }}
        >
            {/* Background decorative orbs */}
            <div
                className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
                style={{ background: '#7289da' }}
            />
            <div
                className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none"
                style={{ background: '#7289da' }}
            />

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-3">
                <DiscordiaMark />
                <span
                    className="text-2xl font-black tracking-tight"
                    style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                >
                    Discordia
                </span>
            </div>

            {/* Main hero content */}
            <div className="relative z-10 space-y-8">
                {/* Floating chat bubbles */}
                <div className="space-y-3 mb-10">
                    <ChatBubble
                        avatar="A"
                        name="Alejandro"
                        message="¡Bienvenidos al servidor! 🎉"
                        time="hoy a las 10:24"
                        color="#7289da"
                    />
                    <ChatBubble
                        avatar="S"
                        name="Sofía"
                        message="¡Qué bueno que llegaste! No te pierdas #anuncios"
                        time="hoy a las 10:25"
                        color="#43b581"
                    />
                    <ChatBubble
                        avatar="M"
                        name="Martín"
                        message="👋 Nuevo por aquí también, hola a todos"
                        time="hoy a las 10:26"
                        color="#faa61a"
                    />
                </div>

                <div>
                    <h1
                        className="text-5xl font-black leading-tight mb-4"
                        style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                    >
                        Tu lugar para
                        <br />
                        <span style={{ color: '#7289da' }}>estar juntos.</span>
                    </h1>
                    <p
                        className="text-lg leading-relaxed max-w-sm"
                        style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
                    >
                        Discordia te une con tus amigos, comunidades y todo lo que te apasiona. Chats, voz y mucho más.
                    </p>
                </div>

                {/* Stats row */}
                <div className="flex gap-8">
                    <Stat value="19M+" label="Servidores activos" />
                    <Stat value="4B+" label="Mensajes al día" />
                    <Stat value="150M" label="Usuarios" />
                </div>
            </div>

            {/* Bottom tagline */}
            <p
                className="relative z-10 text-sm"
                style={{ fontFamily: 'Open Sans, sans-serif', color: '#99aab5' }}
            >
                © 2026 Discordia Inc. Todos los derechos reservados.
            </p>
        </div>
    )
}