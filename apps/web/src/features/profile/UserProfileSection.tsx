import { useState, useEffect } from "react";
import { ProfilePopup } from './ProfilePopup';
import { UserProfileEditModal } from './UserProfileEditModal';
import { useAuth } from "@discordia/core";
import { LogoutIcon } from "@discordia/ui";
import { userService } from "@/shared/api";

export const UserProfileSection = () => {
    const [showProfile, setShowProfile] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const { user, signOut, updateUser } = useAuth();

    useEffect(() => {
        userService.getOwnProfile().then((res) => {
            updateUser(res.data);
        });
    }, []);

    if (!user) {
        return <div>Cargando...</div>;
    }

    return <div className="relative" style={{ background: '#292b2f' }}>
        {showProfile &&
            <ProfilePopup
                user={user}
                onClose={() => setShowProfile(false)}
                onEditProfile={() => setShowEditModal(true)}
            />
        }
        {showEditModal && (<UserProfileEditModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
        />)}
        <div
            className="h-14 flex items-center px-2 gap-2 cursor-pointer transition-colors duration-150"
            style={{ background: showProfile ? 'rgba(114,137,218,0.1)' : 'transparent' }}
            onClick={() => setShowProfile(v => !v)}
            onMouseEnter={e => { if (!showProfile) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (!showProfile) e.currentTarget.style.background = 'transparent' }}
            title="Ver perfil"
        >
            <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                style={{ background: user.avatarUrl ? 'transparent' : '#7289da' }}
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
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate" style={{ fontFamily: 'Nunito, sans-serif' }}>
                    {user.name}
                </p>
                <p className="text-xs" style={{ color: '#43b581' }}>● En línea</p>
            </div>
            <button
                onClick={e => { e.stopPropagation(); signOut() }}
                title="Cerrar sesión"
                className="p-1.5 rounded transition-colors hover:bg-white/10"
                style={{ color: '#72767d' }}
            >
                <LogoutIcon size={19} />
            </button>
        </div>
    </div>
}