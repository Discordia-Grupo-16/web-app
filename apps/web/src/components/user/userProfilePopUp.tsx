import type { User } from "@discordia/types";

export const ProfilePopup = ({ user, onClose, onEditProfile }: { user: User; onClose: () => void; onEditProfile: () => void }) => {
    return (
        <>
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />
            <div
                className="absolute bottom-16 left-2 z-50 w-72 rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: '#18191c', border: '1px solid rgba(255,255,255,0.08)' }}
            >
                <div
                    className="h-20 w-full relative"
                    style={{ background: 'linear-gradient(135deg, #7289da 0%, #5b6eae 50%, #4e5d94 100%)' }}
                >
                    <div
                        className="absolute flex items-center justify-center font-extrabold text-white overflow-hidden"
                        style={{
                            bottom: '-32px',
                            left: '16px',
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            border: '4px solid #18191c',
                            background: user.avatarUrl ? 'transparent' : '#7289da',
                            fontSize: '24px',
                            fontFamily: 'Nunito, sans-serif',
                        }}
                    >
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt={user.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            user.name[0].toUpperCase()
                        )}
                    </div>
                </div>

                <div className="px-4 pt-10 pb-4">
                    <div className="mb-1">
                        <p
                            className="text-base font-black leading-tight"
                            style={{ fontFamily: 'Nunito, sans-serif', color: '#ffffff' }}
                        >
                            {user?.name}
                        </p>
                    </div>

                    {user.bio && (<div className="mb-2">
                        <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#72767d' }}>
                            Sobre mí
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: '#dcddde', fontFamily: 'Open Sans, sans-serif' }}>
                            {user.bio}
                        </p>
                    </div>)}

                    {user.createdAt && (
                        <div className="mb-3">
                            <div className="my-3 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#72767d' }}>
                                Miembro desde
                            </p>
                            <p className="text-sm leading-relaxed" style={{ color: '#dcddde', fontFamily: 'Open Sans, sans-serif' }}>
                                {new Date(user.createdAt).toLocaleDateString('es-AR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>)}

                    <button
                        onClick={() => { onClose(); onEditProfile() }}
                        className="mt-3 w-full py-2 rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer"
                        style={{ background: 'rgba(114,137,218,0.15)', color: '#7289da', border: '1px solid rgba(114,137,218,0.25)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(114,137,218,0.25)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(114,137,218,0.15)' }}
                    >
                        Editar perfil
                    </button>
                </div>
            </div>
        </>
    )
}